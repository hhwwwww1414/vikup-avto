import "server-only";
import { prisma } from "./db";
import { log } from "./logger";
import { recognizePlate } from "./ocr";
import { storeVehiclePhoto } from "./s3";
import {
  answerCallbackQuery,
  deleteMessage,
  downloadFile,
  editMessageText,
  largestPhoto,
  sendChatAction,
  sendMessage,
  type TgCallbackQuery,
  type TgMessage,
} from "./telegram";

const MSG_NO_ACCESS =
  "Доступ не найден.\n\nНапишите администратору, чтобы он привязал ваш Telegram ID к менеджеру.";
const MSG_NOT_RECOGNIZED =
  "Номер не распознан.\n\nПришлите фото ближе к номеру: без бликов, смаза и сильного угла.";
const MSG_INTERNAL_ERROR =
  "Не удалось обработать фото.\n\nПопробуйте отправить его ещё раз.";
const MSG_SEND_PHOTO =
  "Пришлите фото автомобиля, где номер хорошо виден.";

const PHOTO_TIPS =
  "Снимайте номер ближе, без вспышки в отражение, держите камеру ровно. Если номер мелкий в кадре, лучше отправить отдельное фото номера.";

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function garageUrl(plate?: string): string {
  const url = new URL("/garage", process.env.APP_URL || "http://localhost:3000");
  if (plate) url.searchParams.set("q", plate);
  return url.toString();
}

function resultKeyboard(plate?: string) {
  return {
    inline_keyboard: [
      [
        { text: "Открыть в гараже", url: garageUrl(plate) },
        { text: "Как снять лучше", callback_data: "photo_tips" },
      ],
    ],
  };
}

function startChatActionLoop(chatId: number): () => void {
  void sendChatAction(chatId, "upload_photo");
  const timer = setInterval(() => void sendChatAction(chatId, "typing"), 4000);
  return () => clearInterval(timer);
}

function startStatusAnimation(
  chatId: number,
  messageId: number | undefined,
  getText: () => string,
): () => void {
  if (!messageId) return () => undefined;

  let frame = 0;
  const timer = setInterval(() => {
    frame = (frame + 1) % 4;
    const dots = ".".repeat(frame || 1);
    void editMessageText(chatId, messageId, `${getText()}${dots}`);
  }, 1800);

  return () => clearInterval(timer);
}

async function updateStatus(
  chatId: number,
  messageId: number | undefined,
  text: string,
): Promise<void> {
  if (!messageId) return;
  await editMessageText(chatId, messageId, text);
}

async function removeStatus(chatId: number, messageId: number | undefined): Promise<void> {
  if (!messageId) return;
  await deleteMessage(chatId, messageId);
}

async function sendResultCard(
  chatId: number,
  title: string,
  plateDisplay: string,
  details: string,
): Promise<void> {
  const safeTitle = htmlEscape(title);
  const safePlate = htmlEscape(plateDisplay);
  const safeDetails = htmlEscape(details);

  await sendMessage(
    chatId,
    `<b>${safeTitle}</b>\n\n<code>${safePlate}</code>\n${safeDetails}`,
    {
      parseMode: "HTML",
      disableWebPagePreview: true,
      replyMarkup: resultKeyboard(plateDisplay),
    },
  );
}

export async function handleTelegramCallback(query: TgCallbackQuery): Promise<void> {
  if (query.data === "photo_tips") {
    await answerCallbackQuery(query.id, PHOTO_TIPS, true);
    return;
  }

  await answerCallbackQuery(query.id, "Команда недоступна.");
}

/**
 * Handle a single Telegram message. Runs the full ANPR ingestion pipeline.
 * Any failure is contained here and reported to the user; it never throws.
 */
export async function handleTelegramMessage(msg: TgMessage): Promise<void> {
  const chatId = msg.chat.id;
  const fromId = msg.from?.id;
  let statusMessageId: number | undefined;
  let stopChatAction: (() => void) | undefined;
  let stopStatusAnimation: (() => void) | undefined;
  let statusText = "Фото принято.\n\n1/3 Загружаю изображение";

  async function finishStatus(): Promise<void> {
    stopStatusAnimation?.();
    stopStatusAnimation = undefined;
    await removeStatus(chatId, statusMessageId);
    statusMessageId = undefined;
  }

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

    stopChatAction = startChatActionLoop(chatId);
    const status = await sendMessage(
      chatId,
      `${statusText}...`,
    );
    statusMessageId = status?.message_id;
    stopStatusAnimation = startStatusAnimation(chatId, statusMessageId, () => statusText);

    // 3. Download the original photo.
    const image = await downloadFile(fileId);
    if (!image) {
      log.warn("telegram.download.failed", { userId: user.id });
      await finishStatus();
      await sendMessage(chatId, MSG_INTERNAL_ERROR);
      return;
    }

    // 4. ANPR: detect + OCR + russian validation.
    statusText = "Фото загружено.\n\n2/3 Распознаю номер";
    await updateStatus(chatId, statusMessageId, `${statusText}...`);
    const { ocr, plate } = await recognizePlate(image);
    if (!plate) {
      log.info("anpr.failed", {
        userId: user.id,
        found: ocr.found,
        confidence: ocr.confidence,
        ms: ocr.ms,
      });
      await finishStatus();
      await sendMessage(chatId, MSG_NOT_RECOGNIZED, {
        replyMarkup: {
          inline_keyboard: [[{ text: "Как снять лучше", callback_data: "photo_tips" }]],
        },
      });
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
      await finishStatus();
      await sendResultCard(
        chatId,
        "Уже в гараже",
        plate.display,
        "\nЗапись не дублирую. Можно открыть карточку через кнопку ниже.",
      );
      return;
    }

    // 6. Store original + thumbnail in S3.
    statusText = `Номер найден: ${plate.display}\n\n3/3 Сохраняю в гараж`;
    await updateStatus(chatId, statusMessageId, `${statusText}...`);
    let stored;
    try {
      stored = await storeVehiclePhoto(image);
    } catch (e) {
      log.error("s3.upload.failed", { err: String(e) });
      await finishStatus();
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
    await finishStatus();
    await sendResultCard(
      chatId,
      "Автомобиль добавлен",
      plate.display,
      `\nМенеджер: ${user.name}`,
    );
  } catch (e) {
    log.error("telegram.handle.error", { err: String(e) });
    try {
      await finishStatus();
      await sendMessage(chatId, MSG_INTERNAL_ERROR);
    } catch {
      /* ignore */
    }
  } finally {
    stopStatusAnimation?.();
    stopChatAction?.();
  }
}
