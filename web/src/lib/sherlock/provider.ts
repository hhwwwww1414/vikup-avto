import { setTimeout as delay } from "node:timers/promises";
import { TelegramClient } from "teleproto";
import { StringSession } from "teleproto/sessions";
import { FloodWaitError } from "teleproto/errors";
import { NewMessage } from "teleproto/events";
import { env } from "../env";
import { log } from "../logger";
import {
  firstReportUrl,
  FULL_REPORT_BUTTON_RE,
  hasFullReportButton,
  isSherlockReportMessageForPlate,
  messageText,
} from "./provider-message";

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
  private connecting: Promise<TelegramClient<StringSession>> | null = null;

  private async getClient(): Promise<TelegramClient<StringSession>> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;

    this.connecting = (async () => {
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
    })().finally(() => {
      this.connecting = null;
    });

    return this.connecting;
  }

  async lookupByPlate(plate: string): Promise<SherlockProviderResult> {
    const client = await this.getClient();
    const bot = env.sherlockBotUsername.startsWith("@")
      ? env.sherlockBotUsername
      : `@${env.sherlockBotUsername}`;
    const startedAt = Date.now();
    const seenMessageIds = new Set<number>();

    const recovered = await this.findLatestReportLikeMessage(bot, new Set<number>(), plate, 80);
    if (recovered) return this.resultFromMessage(recovered);

    await this.markRecentMessagesSeen(bot, seenMessageIds);
    await withFloodWaitRetry(() => client.sendMessage(bot, { message: plate }));

    const message = await this.waitForReportMessage(bot, seenMessageIds, startedAt, plate);
    return this.resultFromMessage(message);
  }

  private async resultFromMessage(message: TeleMessage): Promise<SherlockProviderResult> {
    const client = await this.getClient();
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
    plate: string,
  ): Promise<TeleMessage> {
    const client = await this.getClient();
    const timeoutMs = env.sherlockLookupTimeoutMs;
    let resolved: TeleMessage | null = null;

    const handler = (event: { message?: TeleMessage }) => {
      const message = event.message;
      if (!message) return;
      if (isSherlockReportMessageForPlate(message, plate)) {
        resolved = message;
        return;
      }
      if (message.id) seenMessageIds.add(message.id);
    };

    client.addEventHandler(handler, new NewMessage({ chats: [bot] }));
    try {
      while (Date.now() - startedAt < timeoutMs) {
        if (resolved) return resolved;
        const latest = await this.findLatestReportLikeMessage(bot, seenMessageIds, plate);
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
    plate: string,
    limit = 10,
  ): Promise<TeleMessage | null> {
    const client = await this.getClient();
    for await (const raw of client.iterMessages(bot, { limit })) {
      const message = raw as TeleMessage;
      const id = typeof message.id === "number" ? message.id : null;
      if (id && seenMessageIds.has(id)) continue;
      if (isSherlockReportMessageForPlate(message, plate)) return message;
      if (id) seenMessageIds.add(id);
    }
    return null;
  }
}
