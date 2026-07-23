import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { getSherlockReportStream } from "@/lib/sherlock/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { reportId: string } },
) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const report = await prisma.sherlockReport.findUnique({
    where: { id: params.reportId },
    select: {
      artifactKey: true,
      contentType: true,
    },
  });
  if (!report) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const object = await getSherlockReportStream(report.artifactKey);
    if (!object.body) {
      return new NextResponse("Not found", { status: 404 });
    }
    const headers = new Headers();
    headers.set("Content-Type", object.contentType || report.contentType);
    if (object.contentLength) headers.set("Content-Length", String(object.contentLength));
    headers.set("Cache-Control", "private, no-store");
    headers.set("Content-Disposition", `inline; filename="sherlock-report-${params.reportId}"`);
    return new NextResponse(object.body, { status: 200, headers });
  } catch (error) {
    log.warn("sherlock.report.download.failed", {
      reportId: params.reportId,
      err: String(error),
    });
    return new NextResponse("Not found", { status: 404 });
  }
}
