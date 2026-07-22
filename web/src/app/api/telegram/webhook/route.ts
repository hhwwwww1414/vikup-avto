import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { handleTelegramMessage } from "@/lib/ingest";
import type { TgUpdate } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deduplicate Telegram retries within the process lifetime.
const seenUpdates = new Set<number>();
function markSeen(id: number): boolean {
  if (seenUpdates.has(id)) return false;
  seenUpdates.add(id);
  if (seenUpdates.size > 1000) {
    // trim oldest-ish (Set preserves insertion order)
    const first = seenUpdates.values().next().value;
    if (first !== undefined) seenUpdates.delete(first);
  }
  return true;
}

export async function POST(req: NextRequest) {
  // Validate the secret token header if a secret is configured.
  const expected = env.telegramWebhookSecret;
  if (expected) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== expected) {
      log.warn("telegram.webhook.badSecret");
      return new NextResponse("forbidden", { status: 403 });
    }
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  log.info("telegram.update.received", { updateId: update.update_id });

  const msg = update.message;
  if (msg && markSeen(update.update_id)) {
    // Process asynchronously; ack Telegram immediately to avoid retries.
    // The long-running Node server keeps this promise alive.
    void handleTelegramMessage(msg).catch((e) =>
      log.error("telegram.async.error", { err: String(e) }),
    );
  }

  return NextResponse.json({ ok: true });
}
