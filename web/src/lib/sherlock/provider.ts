import { setTimeout as delay } from "node:timers/promises";
import { TelegramClient } from "teleproto";
import { StringSession } from "teleproto/sessions";
import { FloodWaitError } from "teleproto/errors";
import { NewMessage } from "teleproto/events";
import { env } from "../env";
import { log } from "../logger";

export interface SherlockProviderResult {
  reportBody: Buffer;
  contentType: string;
  reportUrl: string | null;
  rawMetadata: Record<string, unknown>;
}

export interface SherlockProvider {
  lookupByPlate(plate: string): Promise<SherlockProviderResult>;
}

type TeleMessage = {
  id?: number;
  message?: string;
  text?: string;
  media?: unknown;
  buttons?: Array<Array<{ text?: string }>>;
  click?: (params: { text?: string | RegExp | ((value: string) => boolean); i?: number }) => Promise<unknown>;
};

const REPORT_URL_RE = /https?:\/\/\S+/i;
const REPORT_READY_RE =
  /(\u043e\u0442\u0447(?:\u0435|\u0451)\u0442|report|\u0433\u043e\u0442\u043e\u0432|\u043d\u0430\u0439\u0434\u0435\u043d|\u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d|\u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442|\u0442\u0435\u043b\u0435\u0444\u043e\u043d|\d+(?:[.,]\d+)?\s*%)/iu;
const FULL_REPORT_BUTTON_RE =
  /(full|\(\d+\s*\u0448\u0442\)|\u043f\u043e\u043b\u043d\u044b\u0439\s+\u043e\u0442\u0447(?:\u0435|\u0451)\u0442)/iu;

function messageText(message: TeleMessage): string {
  return String(message.message ?? message.text ?? "");
}

function isFloodWait(error: unknown): error is FloodWaitError {
  return error instanceof FloodWaitError || String(error).includes("FLOOD_WAIT");
}

async function withFloodWaitRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isFloodWait(error)) throw error;
    const seconds =
      error instanceof FloodWaitError && typeof error.seconds === "number"
        ? error.seconds
        : 30;
    log.warn("sherlock.telegram.floodWait", { seconds });
    await delay((seconds + 1) * 1000);
    return fn();
  }
}

function firstReportUrl(text: string): string | null {
  const raw = text.match(REPORT_URL_RE)?.[0];
  return raw ? raw.replace(/[)\].,;]+$/, "") : null;
}

function hasFullReportButton(message: TeleMessage): boolean {
  return Boolean(
    message.buttons?.some((row) =>
      row.some((button) => FULL_REPORT_BUTTON_RE.test(button.text ?? "")),
    ),
  );
}

async function fetchReportUrl(url: string): Promise<{ body: Buffer; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Sherlock report URL returned HTTP ${response.status}`);
  }
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") ?? "application/octet-stream",
  };
}

export class TeleprotoSherlockProvider implements SherlockProvider {
  private client: TelegramClient<StringSession> | null = null;

  private async getClient(): Promise<TelegramClient<StringSession>> {
    if (this.client) return this.client;

    const client = new TelegramClient(
      new StringSession(env.telegramSession),
      env.telegramApiId,
      env.telegramApiHash,
      {
        connectionRetries: 5,
        requestRetries: 3,
        floodSleepThreshold: 60,
      },
    );

    await client.connect();
    if (!(await client.checkAuthorization())) {
      throw new Error("TELEGRAM_SESSION is not authorized");
    }
    this.client = client;
    return client;
  }

  async lookupByPlate(plate: string): Promise<SherlockProviderResult> {
    const client = await this.getClient();
    const bot = env.sherlockBotUsername.startsWith("@")
      ? env.sherlockBotUsername
      : `@${env.sherlockBotUsername}`;
    const startedAt = Date.now();
    const seenMessageIds = new Set<number>();

    await this.markRecentMessagesSeen(bot, seenMessageIds);
    await withFloodWaitRetry(() => client.sendMessage(bot, { message: plate }));

    const message = await this.waitForReportMessage(bot, seenMessageIds, startedAt);
    const text = messageText(message);
    const fullReportUrl = await this.openFullReportUrl(message);
    const reportUrl = fullReportUrl ?? firstReportUrl(text);

    if (fullReportUrl) {
      const fetched = await fetchReportUrl(fullReportUrl);
      return {
        reportBody: fetched.body,
        contentType: fetched.contentType,
        reportUrl: fullReportUrl,
        rawMetadata: { telegramMessageId: message.id, delivery: "full_report_url" },
      };
    }

    if (message.media) {
      const downloaded = await withFloodWaitRetry(() => client.downloadMedia(message as never, {}));
      if (Buffer.isBuffer(downloaded)) {
        return {
          reportBody: downloaded,
          contentType: "application/octet-stream",
          reportUrl,
          rawMetadata: { telegramMessageId: message.id, delivery: "media" },
        };
      }
    }

    if (reportUrl) {
      const fetched = await fetchReportUrl(reportUrl);
      return {
        reportBody: fetched.body,
        contentType: fetched.contentType,
        reportUrl,
        rawMetadata: { telegramMessageId: message.id, delivery: "url" },
      };
    }

    return {
      reportBody: Buffer.from(text, "utf8"),
      contentType: "text/plain; charset=utf-8",
      reportUrl: null,
      rawMetadata: { telegramMessageId: message.id, delivery: "message_text" },
    };
  }

  private async openFullReportUrl(message: TeleMessage): Promise<string | null> {
    if (!message.click || !hasFullReportButton(message)) return null;
    const result = await withFloodWaitRetry(() =>
      message.click?.({
        text: (value: string) => FULL_REPORT_BUTTON_RE.test(value),
      }) ?? Promise.resolve(null),
    );
    if (typeof result === "string") return firstReportUrl(result);
    if (result && typeof result === "object" && "url" in result) {
      return firstReportUrl(String((result as { url?: unknown }).url ?? ""));
    }
    return firstReportUrl(String(result ?? ""));
  }

  private async markRecentMessagesSeen(
    bot: string,
    seenMessageIds: Set<number>,
  ): Promise<void> {
    const client = await this.getClient();
    for await (const raw of client.iterMessages(bot, { limit: 20 })) {
      const message = raw as TeleMessage;
      if (typeof message.id === "number") seenMessageIds.add(message.id);
    }
  }

  private async waitForReportMessage(
    bot: string,
    seenMessageIds: Set<number>,
    startedAt: number,
  ): Promise<TeleMessage> {
    const client = await this.getClient();
    const timeoutMs = env.sherlockLookupTimeoutMs;
    let resolved: TeleMessage | null = null;

    const handler = (event: { message?: TeleMessage }) => {
      const message = event.message;
      if (!message) return;
      const text = messageText(message);
      if (REPORT_READY_RE.test(text) || message.media || hasFullReportButton(message)) {
        resolved = message;
        return;
      }
      if (message.id) seenMessageIds.add(message.id);
    };

    client.addEventHandler(handler, new NewMessage({ chats: [bot] }));
    try {
      while (Date.now() - startedAt < timeoutMs) {
        if (resolved) return resolved;
        const latest = await this.findLatestReportLikeMessage(bot, seenMessageIds);
        if (latest) return latest;
        await delay(1000);
      }
    } finally {
      client.removeEventHandler(handler, new NewMessage({ chats: [bot] }));
    }

    throw new Error(`Sherlock lookup timed out after ${timeoutMs}ms`);
  }

  private async findLatestReportLikeMessage(
    bot: string,
    seenMessageIds: Set<number>,
  ): Promise<TeleMessage | null> {
    const client = await this.getClient();
    for await (const raw of client.iterMessages(bot, { limit: 10 })) {
      const message = raw as TeleMessage;
      const id = typeof message.id === "number" ? message.id : null;
      if (id && seenMessageIds.has(id)) continue;
      const text = messageText(message);
      if (REPORT_READY_RE.test(text) || message.media || hasFullReportButton(message)) return message;
      if (id) seenMessageIds.add(id);
    }
    return null;
  }
}
