/**
 * Minimal structured logger. Never log secrets, tokens, passwords or full env.
 */
type Level = "info" | "warn" | "error";

function emit(level: Level, msg: string, meta?: Record<string, unknown>) {
  const line: Record<string, unknown> = {
    t: new Date().toISOString(),
    level,
    msg,
  };
  if (meta) Object.assign(line, meta);
  const s = JSON.stringify(line);
  if (level === "error") console.error(s);
  else if (level === "warn") console.warn(s);
  else console.log(s);
}

export const log = {
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
