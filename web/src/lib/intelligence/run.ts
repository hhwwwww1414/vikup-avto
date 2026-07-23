import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { generatePlateQueries, PLATE_QUERY_GENERATOR_VERSION } from "./plate-query";
import { InternalHistoryProvider } from "./providers/internal-history";
import { SearxngProvider } from "./providers/searxng";
import { isUsefulSourceHit, rankSourceHits } from "./source-quality";
import type { SearchProvider, StrategyRunSummary } from "./types";

export const DEFAULT_INTELLIGENCE_STRATEGY = "public_vehicle_discovery";
export const DEFAULT_INTELLIGENCE_STRATEGY_VERSION = "2";

function activeProviders(): SearchProvider[] {
  const searxng = new SearxngProvider();
  return [
    new InternalHistoryProvider(),
    ...(searxng.enabled() ? [searxng] : []),
  ];
}

export async function enqueueIntelligenceJob(vehicleId: string): Promise<void> {
  await prisma.intelligenceJob.create({
    data: {
      vehicleId,
      strategy: DEFAULT_INTELLIGENCE_STRATEGY,
      strategyVersion: DEFAULT_INTELLIGENCE_STRATEGY_VERSION,
    },
  });
}

export async function claimNextIntelligenceJob() {
  return prisma.$transaction(async (tx) => {
    const pending = await tx.intelligenceJob.findFirst({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!pending) return null;

    const claimed = await tx.intelligenceJob.updateMany({
      where: { id: pending.id, status: "PENDING" },
      data: {
        status: "RUNNING",
        attempts: { increment: 1 },
        startedAt: new Date(),
        lastError: null,
      },
    });
    if (claimed.count !== 1) return null;

    return tx.intelligenceJob.findUnique({
      where: { id: pending.id },
      include: { vehicle: true },
    });
  });
}

export async function runIntelligenceJob(jobId: string): Promise<StrategyRunSummary> {
  const job = await prisma.intelligenceJob.findUnique({
    where: { id: jobId },
    include: { vehicle: true },
  });
  if (!job) throw new Error(`Intelligence job not found: ${jobId}`);

  const started = Date.now();
  const queries = generatePlateQueries(job.vehicle.licensePlateNormalized);
  const providers = activeProviders();
  const summary: StrategyRunSummary = {
    queryCount: queries.length,
    resultCount: 0,
    usefulResultCount: 0,
    vehicleMatchCount: 0,
    contactFound: false,
    contactCandidateCount: 0,
    latencyMs: 0,
    errors: [],
  };
  const contactCandidates: Array<{
    source: string;
    url?: string;
    title?: string;
    publicPhone?: string;
    publicEmail?: string;
    confidence?: number;
  }> = [];

  const experiment = await prisma.experimentRun.create({
    data: {
      vehicleId: job.vehicleId,
      jobId: job.id,
      strategy: job.strategy,
      strategyVersion: job.strategyVersion,
      parameters: {
        queryGenerator: PLATE_QUERY_GENERATOR_VERSION,
        providers: providers.map((provider) => provider.name),
      },
    },
  });

  try {
    for (const provider of providers) {
      const searchRun = await prisma.searchRun.create({
        data: {
          experimentRunId: experiment.id,
          provider: provider.name,
        },
      });

      let providerResultCount = 0;
      const providerStarted = Date.now();

      try {
        for (const generated of queries) {
          const queryStarted = Date.now();
          const hits = rankSourceHits(await provider.search(generated.query, {
            vehicleId: job.vehicleId,
            plateNormalized: job.vehicle.licensePlateNormalized,
          }));
          const latencyMs = Date.now() - queryStarted;
          const vehicleMatchCount = hits.filter((hit) => hit.plate === job.vehicle.licensePlateNormalized).length;
          const contactFound = hits.some((hit) => Boolean(hit.publicPhone || hit.publicEmail));
          const queryContactCandidates = hits.filter((hit) => Boolean(hit.publicPhone || hit.publicEmail));
          const usefulResultCount = hits.filter(isUsefulSourceHit).length;

          summary.resultCount += hits.length;
          summary.usefulResultCount += usefulResultCount;
          summary.vehicleMatchCount += vehicleMatchCount;
          summary.contactFound ||= contactFound;
          summary.contactCandidateCount += queryContactCandidates.length;
          providerResultCount += hits.length;
          contactCandidates.push(
            ...queryContactCandidates.map((hit) => ({
              source: hit.source,
              url: hit.url,
              title: hit.title,
              publicPhone: hit.publicPhone,
              publicEmail: hit.publicEmail,
              confidence: hit.confidence,
            })),
          );

          await prisma.searchQuery.create({
            data: {
              searchRunId: searchRun.id,
              query: generated.query,
              queryType: generated.queryType,
              generatedBy: generated.generatedBy,
              resultCount: hits.length,
              usefulResultCount,
              vehicleMatchCount,
              contactFound,
              latencyMs,
              results: {
                create: hits.map((hit) => ({
                  source: hit.source,
                  url: hit.url,
                  title: hit.title,
                  snippet: hit.snippet,
                  raw: hit.raw === undefined ? undefined : (hit.raw as object),
                  normalized: hit.normalized === undefined ? undefined : (hit.normalized as object),
                  derived: hit.derived === undefined ? undefined : (hit.derived as object),
                  confidence: hit.confidence,
                  fetchedAt: hit.fetchedAt,
                })),
              },
            },
          });
        }

        await prisma.searchRun.update({
          where: { id: searchRun.id },
          data: {
            status: "DONE",
            finishedAt: new Date(),
            metrics: {
              resultCount: providerResultCount,
              latencyMs: Date.now() - providerStarted,
            },
          },
        });
      } catch (e) {
        const message = String(e);
        summary.errors.push(`${provider.name}: ${message}`);
        await prisma.searchRun.update({
          where: { id: searchRun.id },
          data: {
            status: "FAILED",
            error: message,
            finishedAt: new Date(),
            metrics: {
              resultCount: providerResultCount,
              latencyMs: Date.now() - providerStarted,
            },
          },
        });
      }
    }

    summary.latencyMs = Date.now() - started;
    const finalStatus = summary.errors.length > 0 ? "FAILED" : "DONE";

    await prisma.experimentRun.update({
      where: { id: experiment.id },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        metrics: { ...summary },
        results: {
          bestPublicContact: contactCandidates[0] ?? null,
          contactCandidates,
          confidence: contactCandidates[0]?.confidence ?? null,
          note: "Contacts are explicit public seller/dealer/profile candidates, not inferred vehicle owner phones.",
        },
      },
    });
    await prisma.intelligenceJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        metrics: { ...summary },
        lastError: summary.errors[0] ?? null,
      },
    });

    log.info("intelligence.job.done", { jobId: job.id, ...summary });
    return summary;
  } catch (e) {
    const message = String(e);
    await prisma.experimentRun.update({
      where: { id: experiment.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        metrics: { ...summary, latencyMs: Date.now() - started, errors: [message] },
      },
    });
    await prisma.intelligenceJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        lastError: message,
        metrics: { ...summary, latencyMs: Date.now() - started, errors: [message] },
      },
    });
    throw e;
  }
}

export async function runNextIntelligenceJob(): Promise<boolean> {
  const job = await claimNextIntelligenceJob();
  if (!job) return false;
  await runIntelligenceJob(job.id);
  return true;
}
