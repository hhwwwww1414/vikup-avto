import "server-only";
import { env } from "./env";
import { log } from "./logger";

const API = () => `https://api.telegram.org/bot${env.telegramBotToken}`;
const FILE_API = () => `https://api.telegram.org/file/bot${env.telegramBotToken}`;

const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20 MB safety cap

export interface TgPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TgMessage {
  message_id: number;
  from?: { id: number; first_name?: string; username?: string };
  chat: { id: number };
  photo?: TgPhotoSize[];
  document?: { file_id: string; mime_type?: string; file_size?: number };
}

export interface TgCallbackQuery {
  id: string;
  from: { id: number };
  message?: TgMessage;
  data?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

export interface TgInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface TgInlineKeyboardMarkup {
  inline_keyboard: TgInlineKeyboardButton[][];
}

export interface SendMessageOptions {
  parseMode?: "HTML";
  replyMarkup?: TgInlineKeyboardMarkup;
  disableWebPagePreview?: boolean;
}

export interface TgSentMessage {
  message_id: number;
}

function messageBody(chatId: number, text: string, options: SendMessageOptions = {}) {
  return {
    chat_id: chatId,
    text,
    parse_mode: options.parseMode,
    reply_markup: options.replyMarkup,
    disable_web_page_preview: options.disableWebPagePreview,
  };
}

export async function sendMessage(
  chatId: number,
  text: string,
  options: SendMessageOptions = {},
): Promise<TgSentMessage | null> {
  try {
    const res = await fetch(`${API()}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(messageBody(chatId, text, options)),
    });
    if (!res.ok) {
      log.warn("telegram.sendMessage.failed", { status: res.status });
      return null;
    }
    const json = (await res.json()) as { ok: boolean; result?: TgSentMessage };
    return json.ok && json.result ? json.result : null;
  } catch (e) {
    log.warn("telegram.sendMessage.error", { err: String(e) });
    return null;
  }
}

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  options: SendMessageOptions = {},
): Promise<boolean> {
  try {
    const res = await fetch(`${API()}/editMessageText`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...messageBody(chatId, text, options),
        message_id: messageId,
      }),
    });
    if (!res.ok) {
      log.warn("telegram.editMessageText.failed", { status: res.status });
      return false;
    }
    return true;
  } catch (e) {
    log.warn("telegram.editMessageText.error", { err: String(e) });
    return false;
  }
}

export async function deleteMessage(chatId: number, messageId: number): Promise<boolean> {
  try {
    const res = await fetch(`${API()}/deleteMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    if (!res.ok) {
      log.warn("telegram.deleteMessage.failed", { status: res.status });
      return false;
    }
    return true;
  } catch (e) {
    log.warn("telegram.deleteMessage.error", { err: String(e) });
    return false;
  }
}

export async function sendChatAction(
  chatId: number,
  action: "typing" | "upload_photo",
): Promise<void> {
  try {
    const res = await fetch(`${API()}/sendChatAction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
    if (!res.ok) {
      log.warn("telegram.sendChatAction.failed", { status: res.status });
    }
  } catch (e) {
    log.warn("telegram.sendChatAction.error", { err: String(e) });
  }
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text: string,
  showAlert = false,
): Promise<void> {
  try {
    const res = await fetch(`${API()}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });
    if (!res.ok) {
      log.warn("telegram.answerCallbackQuery.failed", { status: res.status });
    }
  } catch (e) {
    log.warn("telegram.answerCallbackQuery.error", { err: String(e) });
  }
}

/** Returns the direct file path for a given file_id via getFile. */
async function getFilePath(fileId: string): Promise<string | null> {
  const res = await fetch(`${API()}/getFile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { ok: boolean; result?: { file_path?: string } };
  return json.ok && json.result?.file_path ? json.result.file_path : null;
}

/** Download a Telegram file by file_id. Enforces a max size. */
export async function downloadFile(fileId: string): Promise<Buffer | null> {
  const path = await getFilePath(fileId);
  if (!path) return null;
  const res = await fetch(`${FILE_API()}/${path}`);
  if (!res.ok) return null;

  const lenHeader = res.headers.get("content-length");
  if (lenHeader && Number(lenHeader) > MAX_PHOTO_BYTES) {
    log.warn("telegram.download.tooLarge", { size: lenHeader });
    return null;
  }
  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength > MAX_PHOTO_BYTES) return null;
  return Buffer.from(arrayBuf);
}

/** Pick the highest-resolution photo size from a message. */
export function largestPhoto(msg: TgMessage): TgPhotoSize | null {
  if (!msg.photo || msg.photo.length === 0) return null;
  return msg.photo.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
}

export async function setWebhook(url: string, secret: string): Promise<unknown> {
  const res = await fetch(`${API()}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret || undefined,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    }),
  });
  return res.json();
}
