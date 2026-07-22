import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getObjectStream } from "@/lib/s3";
import { isAllowedKey } from "@/lib/s3-keys";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!isAllowedKey(key)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const obj = await getObjectStream(key);
    if (!obj.body) {
      return new NextResponse("Not found", { status: 404 });
    }
    const headers = new Headers();
    headers.set("Content-Type", obj.contentType);
    if (obj.contentLength) headers.set("Content-Length", String(obj.contentLength));
    // Private user-scoped cache; immutable objects (uuid keys never change).
    headers.set("Cache-Control", "private, max-age=86400, immutable");
    return new NextResponse(obj.body, { status: 200, headers });
  } catch (e) {
    log.warn("image.proxy.failed", { err: String(e) });
    return new NextResponse("Not found", { status: 404 });
  }
}
