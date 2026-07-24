import { Prisma, SherlockLookupStatus } from "@prisma/client";
import { prisma } from "../db";
import { env } from "../env";
import { log } from "../logger";
import { shouldSendPaidSherlockRequest } from "./job-policy";
import { buildSherlockReportKey, parseSherlockReport } from "./report-parser";
import {
  TeleprotoSherlockProvider,
  type SherlockProvider,
  type SherlockProviderResult,
} from "./provider";
import { storeSherlockReportArtifact } from "./storage";

const RETRY_BACKOFF_MINUTES = [2, 10, 30];

function retryAt(attempts: number): Date {
  const minutes = RETRY_BACKOFF_MINUTES[Math.min(attempts - 1, RETRY_BACKOFF_MINUTES.length - 1)];
  return new Date(Date.now() + minutes * 60_000);
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type StoredSherlockReportData = ReturnType<typeof parseSherlockReport>;

function reportData(report: { normalizedData: Prisma.JsonValue }): StoredSherlockReportData {
  return report.normalizedData as unknown as StoredSherlockReportData;
}

function isReusableSherlockReport(report: {
  reportUrl: string | null;
  normalizedData: Prisma.JsonValue;
}): boolean {
  const normalized = reportData(report);
  return Boolean(report.reportUrl || normalized.phoneCandidates?.length);
}

function vehicleSherlockDataFromReport(report: {
  normalizedData: Prisma.JsonValue;
}): {
  sherlockLookupStatus: SherlockLookupStatus;
  sherlockBestPhone: string | null;
  sherlockBestProviderConfidence: number | null;
  sherlockHasMultipleTopCandidates: boolean;
  sherlockUpdatedAt: Date;
} {
  const normalized = reportData(report);
  return {
    sherlockLookupStatus: SherlockLookupStatus.DONE,
    sherlockBestPhone: normalized.bestPhone ?? null,
    sherlockBestProviderConfidence: normalized.bestProviderConfidence ?? null,
    sherlockHasMultipleTopCandidates: Boolean(normalized.hasMultipleTopCandidates),
    sherlockUpdatedAt: new Date(),
  };
}

export async function enqueueSherlockLookupForVehicle(vehicleId: string): Promise<string | null> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      licensePlateNormalized: true,
    },
  });
  if (!vehicle) return null;

  const freshAfter = new Date(Date.now() - env.sherlockFreshReportTtlHours * 60 * 60_000);
  const existingReport = await prisma.sherlockReport.findFirst({
    where: {
      searchedPlate: vehicle.licensePlateNormalized,
      createdAt: { gte: freshAfter },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingReport && isReusableSherlockReport(existingReport)) {
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: vehicleSherlockDataFromReport(existingReport),
    });
    log.info("sherlock.lookup.reused", {
      vehicleId: vehicle.id,
      reportId: existingReport.id,
      plate: vehicle.licensePlateNormalized,
    });
    return null;
  }

  const job = await prisma.sherlockLookupJob.create({
    data: {
      vehicleId: vehicle.id,
      searchedPlate: vehicle.licensePlateNormalized,
    },
    select: { id: true },
  });
  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: {
      sherlockLookupStatus: SherlockLookupStatus.PENDING,
      sherlockUpdatedAt: new Date(),
    },
  });
  log.info("sherlock.lookup.enqueued", {
    vehicleId: vehicle.id,
    jobId: job.id,
    plate: vehicle.licensePlateNormalized,
  });
  return job.id;
}

export async function retrySherlockLookupForVehicle(vehicleId: string): Promise<string | null> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: {
      id: true,
      licensePlateNormalized: true,
    },
  });
  if (!vehicle) return null;

  const running = await prisma.sherlockLookupJob.findFirst({
    where: {
      vehicleId,
      status: {
        in: [
          SherlockLookupStatus.PENDING,
          SherlockLookupStatus.RUNNING,
          SherlockLookupStatus.WAITING_REPORT,
          SherlockLookupStatus.PARSING,
        ],
      },
    },
    select: { id: true },
  });
  if (running) return running.id;

  const recentManualGuard = await prisma.sherlockLookupJob.findFirst({
    where: {
      vehicleId,
      createdAt: { gte: new Date(Date.now() - 2 * 60_000) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (recentManualGuard) return recentManualGuard.id;

  const job = await prisma.sherlockLookupJob.create({
    data: {
      vehicleId: vehicle.id,
      searchedPlate: vehicle.licensePlateNormalized,
    },
    select: { id: true },
  });
  await prisma.vehicle.update({
    where: { id: vehicle.id },
    data: {
      sherlockLookupStatus: SherlockLookupStatus.PENDING,
      sherlockUpdatedAt: new Date(),
    },
  });
  log.info("sherlock.lookup.retryEnqueued", {
    vehicleId: vehicle.id,
    jobId: job.id,
    plate: vehicle.licensePlateNormalized,
  });
  return job.id;
}

export async function acquireNextSherlockLookupJob() {
  const now = new Date();
  const staleLockedBefore = new Date(
    now.getTime() - Math.max(env.sherlockLookupTimeoutMs, 5 * 60_000),
  );
  const job = await prisma.sherlockLookupJob.findFirst({
    where: {
      OR: [
        {
          status: { in: [SherlockLookupStatus.PENDING, SherlockLookupStatus.FAILED] },
          nextRunAt: { lte: now },
        },
        {
          status: {
            in: [
              SherlockLookupStatus.RUNNING,
              SherlockLookupStatus.WAITING_REPORT,
              SherlockLookupStatus.PARSING,
            ],
          },
          lockedAt: { lte: staleLockedBefore },
        },
      ],
    },
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
  });
  if (!job) return null;

  const result = await prisma.sherlockLookupJob.updateMany({
    where: {
      id: job.id,
      status: job.status,
    },
    data: {
      status: SherlockLookupStatus.RUNNING,
      attempts: { increment: 1 },
      lockedAt: new Date(),
      startedAt: new Date(),
      errorMessage: null,
    },
  });
  if (result.count !== 1) return null;

  return prisma.sherlockLookupJob.findUnique({
    where: { id: job.id },
    include: { vehicle: true },
  });
}

async function failJob(jobId: string, error: unknown): Promise<void> {
  const job = await prisma.sherlockLookupJob.findUnique({
    where: { id: jobId },
    select: { attempts: true, maxAttempts: true, vehicleId: true },
  });
  if (!job) return;

  const latestReusableReport = await prisma.sherlockReport.findFirst({
    where: { vehicleId: job.vehicleId },
    orderBy: { createdAt: "desc" },
  });
  const exhausted = job.attempts >= job.maxAttempts;
  const vehicleData =
    latestReusableReport && isReusableSherlockReport(latestReusableReport)
      ? vehicleSherlockDataFromReport(latestReusableReport)
      : exhausted
        ? {
            sherlockLookupStatus: SherlockLookupStatus.FAILED,
            sherlockUpdatedAt: new Date(),
          }
      : {
          sherlockLookupStatus: SherlockLookupStatus.PENDING,
          sherlockUpdatedAt: new Date(),
        };

  await prisma.$transaction([
    prisma.sherlockLookupJob.update({
      where: { id: jobId },
      data: {
        status: SherlockLookupStatus.FAILED,
        finishedAt: exhausted ? new Date() : null,
        lockedAt: null,
        errorMessage: String(error).slice(0, 1000),
        nextRunAt: exhausted ? new Date("9999-12-31T00:00:00.000Z") : retryAt(job.attempts),
      },
    }),
    prisma.vehicle.update({
      where: { id: job.vehicleId },
      data: vehicleData,
    }),
  ]);
}

async function completeSherlockLookupJob(
  job: { id: string; vehicleId: string; searchedPlate: string },
  result: SherlockProviderResult,
): Promise<void> {
  await prisma.sherlockLookupJob.update({
    where: { id: job.id },
    data: { status: SherlockLookupStatus.PARSING },
  });

  const rawText =
    result.contentType.includes("text") || result.contentType.includes("json")
      ? result.reportBody.toString("utf8")
      : "";
  const parsed = parseSherlockReport(rawText, {
    searchedPlate: job.searchedPlate,
    reportUrl: result.reportUrl,
  });
  const artifactKey = buildSherlockReportKey(job.vehicleId, job.id, result.contentType);
  await storeSherlockReportArtifact({
    key: artifactKey,
    body: result.reportBody,
    contentType: result.contentType,
  });

  await prisma.$transaction(async (tx) => {
    const report = await tx.sherlockReport.create({
      data: {
        vehicleId: job.vehicleId,
        lookupJobId: job.id,
        searchedPlate: job.searchedPlate,
        reportUrl: result.reportUrl,
        artifactKey,
        contentType: result.contentType,
        normalizedData: asJson(parsed),
        rawMetadata: asJson(result.rawMetadata),
        parserVersion: parsed.parserVersion,
      },
    });
    if (parsed.phoneCandidates.length > 0) {
      await tx.sherlockPhoneCandidate.createMany({
        data: parsed.phoneCandidates.map((candidate) => ({
          vehicleId: job.vehicleId,
          lookupJobId: job.id,
          reportId: report.id,
          phone: candidate.phone,
          providerConfidence: candidate.providerConfidence,
          rank: candidate.rank,
          source: candidate.source,
          fetchedAt: new Date(candidate.fetchedAt),
        })),
      });
    }
    await tx.vehicle.update({
      where: { id: job.vehicleId },
      data: {
        sherlockLookupStatus: SherlockLookupStatus.DONE,
        sherlockBestPhone: parsed.bestPhone,
        sherlockBestProviderConfidence: parsed.bestProviderConfidence,
        sherlockHasMultipleTopCandidates: parsed.hasMultipleTopCandidates,
        sherlockUpdatedAt: new Date(),
      },
    });
    await tx.sherlockLookupJob.update({
      where: { id: job.id },
      data: {
        status: SherlockLookupStatus.DONE,
        finishedAt: new Date(),
        lockedAt: null,
        rawMetadata: asJson(result.rawMetadata),
      },
    });
  });

  log.info("sherlock.lookup.done", {
    jobId: job.id,
    vehicleId: job.vehicleId,
    plate: job.searchedPlate,
    candidates: parsed.phoneCandidates.length,
  });
}

async function recoverSherlockLookupJobFromHistory(
  job: { id: string; vehicleId: string; searchedPlate: string },
  provider: SherlockProvider,
): Promise<boolean> {
  if (!provider.recoverLatestByPlate) return false;

  try {
    const recovered = await provider.recoverLatestByPlate(job.searchedPlate);
    if (!recovered) return false;

    log.warn("sherlock.lookup.recoveredAfterFailure", {
      jobId: job.id,
      vehicleId: job.vehicleId,
      plate: job.searchedPlate,
    });
    await completeSherlockLookupJob(job, recovered);
    return true;
  } catch (error) {
    log.warn("sherlock.lookup.recoveryFailed", {
      jobId: job.id,
      vehicleId: job.vehicleId,
      plate: job.searchedPlate,
      err: String(error),
    });
    return false;
  }
}

export async function processSherlockLookupJob(
  jobId: string,
  provider: SherlockProvider = new TeleprotoSherlockProvider(),
): Promise<void> {
  const job = await prisma.sherlockLookupJob.findUnique({
    where: { id: jobId },
    include: { vehicle: true },
  });
  if (!job) return;

  try {
    await prisma.sherlockLookupJob.update({
      where: { id: job.id },
      data: { status: SherlockLookupStatus.WAITING_REPORT },
    });
    const result = shouldSendPaidSherlockRequest(job.attempts)
      ? await provider.lookupByPlate(job.searchedPlate)
      : await provider.recoverLatestByPlate?.(job.searchedPlate);
    if (!result) {
      throw new Error(`Sherlock report was not recovered from history after attempt ${job.attempts}`);
    }
    await completeSherlockLookupJob(job, result);
  } catch (error) {
    if (await recoverSherlockLookupJobFromHistory(job, provider)) return;

    log.error("sherlock.lookup.failed", {
      jobId: job.id,
      vehicleId: job.vehicleId,
      err: String(error),
    });
    await failJob(job.id, error);
  }
}
