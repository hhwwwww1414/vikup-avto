/**
 * Centralized environment access. Values are read lazily so that build-time
 * (when some secrets are absent) does not crash; runtime access throws if a
 * required variable is missing.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  get appUrl() {
    return optional("APP_URL", "http://localhost:3000");
  },
  get nodeEnv() {
    return optional("NODE_ENV", "development");
  },
  get isProd() {
    return process.env.NODE_ENV === "production";
  },
  get authSecret() {
    return required("AUTH_SECRET");
  },
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  // Telegram
  get telegramBotToken() {
    return required("TELEGRAM_BOT_TOKEN");
  },
  get telegramBotUsername() {
    return optional("TELEGRAM_BOT_USERNAME");
  },
  get telegramWebhookSecret() {
    return optional("TELEGRAM_WEBHOOK_SECRET");
  },
  // S3
  get s3Endpoint() {
    return required("S3_ENDPOINT");
  },
  get s3Region() {
    return optional("S3_REGION", "ru-1");
  },
  get s3Bucket() {
    return required("S3_BUCKET");
  },
  get s3AccessKeyId() {
    return required("S3_ACCESS_KEY_ID");
  },
  get s3SecretAccessKey() {
    return required("S3_SECRET_ACCESS_KEY");
  },
  get s3ForcePathStyle() {
    return optional("S3_FORCE_PATH_STYLE", "true") === "true";
  },
  // OCR service
  get ocrUrl() {
    return optional("OCR_URL", "http://ocr:8000");
  },
  get ocrConfidenceMin() {
    const v = process.env.OCR_CONFIDENCE_MIN;
    return v ? Number(v) : 0.4;
  },
};
