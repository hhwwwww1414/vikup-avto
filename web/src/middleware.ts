import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "vikup_session";

// Routes that require an authenticated user.
const PROTECTED_PREFIXES = ["/garage", "/managers", "/analytics"];
// Routes that require ADMIN role.
const ADMIN_PREFIXES = ["/managers", "/analytics"];

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

async function readSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload as { sub?: string; role?: string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (!isProtected) return NextResponse.next();

  const session = await readSession(req);

  if (!session?.sub) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const isAdminRoute = ADMIN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (isAdminRoute && session.role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/garage";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/garage/:path*", "/managers/:path*", "/analytics/:path*"],
};
