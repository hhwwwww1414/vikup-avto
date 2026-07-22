import "server-only";
import { prisma } from "./db";
import { log } from "./logger";
import { recognizePlate } from "./ocr";
import { storeVehiclePhoto } from "./s3";
import {
  downloadFile,
  largestPhoto,
  sendMessage,
  type TgMessage,
} from "./telegram";

const MSG_NO_ACCESS = "⛔ У вас нет доступа к VIKUP.";
const MSG_PROCESSING = "⏳ Обрабатываю фотографию...";
const MSG_NOT_RECOGNIZED =
  "❌ Не удалось уверенно распознать госномер.\n\nПопробуйте отправить другую фотографию.";
const MSG_INTERNAL_ERROR =
  "❌ Не удалось обработать фотографию.\n\nПопробуйте ещё раз.";
const MSG_SEND_PHOTO =
  "📸 Отправьте фотографию автомобиля, на которой виден госномер.";

/**
 * Handle a single Telegram message. Runs the full ANPR ingestion pipeline.
 * Any failure is contained here and reported to the user; it never throws.
 */
export async function handleTelegramMessage(msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const fromId = msg.from?.id;

  try {
    if (!fromId) return;

    // 1. Authorize sender by telegram_id (must be an active user).
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(fromId) },
    });
    if (!user || !user.isActive) {
      log.warn("telegram.unauthorized", { fromId });
      await sendMessage(chatId, MSG_NO_ACCESS);
      return;
    }
    log.info("telegram.authorized", { userId: user.id, fromId });

    // 2. Ensure there is a photo (also accept image documents).
    const photo = largestPhoto(msg);
    const fileId =
      photo?.file_id ??
      (msg.document?.mime_type?.startsWith("image/") ? msg.document.file_id : undefined);
    if (!fileId) {
      await sendMessage(chatId, MSG_SEND_PHOTO);
      return;
    }

    await sendMessage(chatId, MSG_PROCESSING);

    // 3. Download the original photo.
    const image = await downloadFile(fileId);
    if (!image) {
      log.warn("telegram.download.failed", { userId: user.id });
      await sendMessage(chatId, MSG_INTERNAL_ERROR);
      return;
    }

    // 4. ANPR: detect + OCR + russian validation.
    const { ocr, plate } = await recognizePlate(image);
    if (!plate) {
      log.info("anpr.failed", {
        userId: user.id,
        found: ocr.found,
        confidence: ocr.confidence,
        ms: ocr.ms,
      });
      await sendMessage(chatId, MSG_NOT_RECOGNIZED);
      return;
    }
    log.info("anpr.success", {
      userId: user.id,
      plate: plate.normalized,
      confidence: ocr.confidence,
      ms: ocr.ms,
    });

    // 5. Duplicate check (skip-duplicate policy, documented in README).
    const existing = await prisma.vehicle.findFirst({
      where: { licensePlateNormalized: plate.normalized },
      select: { id: true },
    });
    if (existing) {
      log.info("vehicle.duplicate", { plate: plate.normalized });
      await sendMessage(
        chatId,
        `ℹ️ Этот автомобиль уже есть в гараже:\n\n${plate.display}`,
      );
      return;
    }

    // 6. Store original + thumbnail in S3.
    let stored;
    try {
      stored = await storeVehiclePhoto(image);
    } catch (e) {
      log.error("s3.upload.failed", { err: String(e) });
      await sendMessage(chatId, MSG_INTERNAL_ERROR);
      return;
    }

    // 7. Create Vehicle.
    await prisma.vehicle.create({
      data: {
        photoKey: stored.photoKey,
        licensePlate: plate.display,
        licensePlateNormalized: plate.normalized,
        managerId: user.id,
        telegramMessageId: BigInt(msg.message_id),
      },
    });
    log.info("vehicle.created", { plate: plate.normalized, userId: user.id });

    // 8. Confirm.
    await sendMessage(chatId, `✅ Автомобиль добавлен\n\n${plate.display}`);
  } catch (e) {
    log.error("telegram.handle.error", { err: String(e) });
    try {
      await sendMessage(chatId, MSG_INTERNAL_ERROR);
    } catch {
      /* ignore */
    }
  }
}
