import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const schema = z.object({
  login: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // Rate limit: 10 attempts / 5 minutes per IP.
  const rl = rateLimit(`login:${ip}`, 10, 5 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Слишком много попыток. Попробуйте позже." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Введите логин и пароль" }, { status: 400 });
  }

  const login = parsed.data.login.trim();
  const user = await prisma.user.findUnique({ where: { login } });

  // Generic error to avoid user enumeration.
  const invalid = () =>
    NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });

  if (!user || !user.isActive) {
    // Still spend time to reduce timing signal.
    await verifyPassword(parsed.data.password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinva");
    return invalid();
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    log.warn("auth.login.failed", { login });
    return invalid();
  }

  await setSessionCookie({
    sub: user.id,
    name: user.name,
    role: user.role,
    login: user.login,
  });
  log.info("auth.login.success", { userId: user.id, role: user.role });

  return NextResponse.json({ ok: true });
}
