import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";

export const SESSION_COOKIE = "vikup_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type Role = "ADMIN" | "MANAGER";

export interface SessionPayload {
  sub: string; // user id
  name: string;
  role: Role;
  login: string;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.sub === "string" &&
      typeof payload.name === "string" &&
      (payload.role === "ADMIN" || payload.role === "MANAGER") &&
      typeof payload.login === "string"
    ) {
      return {
        sub: payload.sub,
        name: payload.name,
        role: payload.role,
        login: payload.login,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(): void {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Read + verify the current session from cookies (server components / routes). */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Throws-friendly guard for server components. Returns session or null. */
export async function requireSession(): Promise<SessionPayload | null> {
  return getSession();
}
