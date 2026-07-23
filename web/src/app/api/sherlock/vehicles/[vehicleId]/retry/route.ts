import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { log } from "@/lib/logger";
import { retrySherlockLookupForVehicle } from "@/lib/sherlock/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { vehicleId: string } },
) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const jobId = await retrySherlockLookupForVehicle(params.vehicleId);
    return NextResponse.json({ ok: true, jobId });
  } catch (error) {
    log.warn("sherlock.retry.failed", {
      vehicleId: params.vehicleId,
      err: String(error),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
