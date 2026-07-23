import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plate } from "@/components/Plate";
import { getSession } from "@/lib/auth";
import { formatCardDate } from "@/lib/date";
import { prisma } from "@/lib/db";
import { thumbKey } from "@/lib/s3-keys";
import { rerunIntelligence } from "./actions";

export const dynamic = "force-dynamic";

interface ContactView {
  source?: string;
  url?: string;
  title?: string;
  publicPhone?: string;
  publicEmail?: string;
  confidence?: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function contactFromResults(results: unknown): ContactView | null {
  const record = asRecord(results);
  const best = asRecord(record.bestPublicContact);
  const phone = typeof best.publicPhone === "string" ? best.publicPhone : undefined;
  const email = typeof best.publicEmail === "string" ? best.publicEmail : undefined;
  if (!phone && !email) return null;

  return {
    source: typeof best.source === "string" ? best.source : undefined,
    url: typeof best.url === "string" ? best.url : undefined,
    title: typeof best.title === "string" ? best.title : undefined,
    publicPhone: phone,
    publicEmail: email,
    confidence: typeof best.confidence === "number" ? best.confidence : undefined,
  };
}

function metricNumber(metrics: unknown, key: string): number {
  const value = asRecord(metrics)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function confidencePct(value?: number): string {
  if (typeof value !== "number") return "-";
  return `${Math.round(value * 100)}%`;
}

export default async function VehicleDetailPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      photoKey: true,
      licensePlateNormalized: true,
      createdAt: true,
      manager: { select: { name: true } },
      intelligenceJobs: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          strategy: true,
          strategyVersion: true,
          attempts: true,
          lastError: true,
          metrics: true,
          createdAt: true,
          startedAt: true,
          finishedAt: true,
        },
      },
      experimentRuns: {
        orderBy: { startedAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          strategy: true,
          strategyVersion: true,
          metrics: true,
          results: true,
          startedAt: true,
          finishedAt: true,
          searchRuns: {
            orderBy: { startedAt: "desc" },
            take: 5,
            select: {
              provider: true,
              status: true,
              error: true,
              queries: {
                orderBy: { createdAt: "asc" },
                take: 12,
                select: {
                  query: true,
                  resultCount: true,
                  vehicleMatchCount: true,
                  contactFound: true,
                  results: {
                    take: 3,
                    select: {
                      source: true,
                      url: true,
                      title: true,
                      snippet: true,
                      confidence: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!vehicle) notFound();

  const latestRun = vehicle.experimentRuns[0];
  const bestContact = contactFromResults(latestRun?.results);
  const latestJob = vehicle.intelligenceJobs[0];
  const src = `/api/image?key=${encodeURIComponent(thumbKey(vehicle.photoKey))}`;
  const full = `/api/image?key=${encodeURIComponent(vehicle.photoKey)}`;
  const rerun = rerunIntelligence.bind(null, vehicle.id);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link href="/garage" className="text-sm font-bold text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Back to garage
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Vehicle intelligence</h1>
        </div>
        {session.role === "ADMIN" ? (
          <form action={rerun}>
            <button className="dashboard-button px-4 py-2.5 text-sm">Run intelligence</button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="dashboard-panel overflow-hidden">
          <a href={full} target="_blank" rel="noreferrer" className="block bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={vehicle.licensePlateNormalized} className="aspect-[4/3] w-full object-cover" />
          </a>
          <div className="p-5">
            <div className="flex justify-center">
              <Plate value={vehicle.licensePlateNormalized} />
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-[var(--muted)]">Manager</dt>
                <dd className="font-bold text-[var(--text)]">{vehicle.manager.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-[var(--muted)]">Captured</dt>
                <dd className="font-bold text-[var(--text)]">{formatCardDate(vehicle.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-[var(--muted)]">Job</dt>
                <dd className="font-bold text-[var(--text)]">{latestJob?.status ?? "NONE"}</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="space-y-6">
          <section className="dashboard-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-base font-bold text-[var(--text)]">Best public contact</h2>
              <span className="rounded-full bg-[var(--panel-strong)] px-2.5 py-1 text-xs font-bold text-[var(--muted-strong)]">
                {bestContact ? confidencePct(bestContact.confidence) : "pending"}
              </span>
            </div>
            {bestContact ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <div>
                  <div className="text-2xl font-bold tabular-nums text-[var(--text)]">
                    {bestContact.publicPhone ?? bestContact.publicEmail}
                  </div>
                  <div className="mt-2 text-sm font-medium text-[var(--muted)]">
                    Public seller/dealer/profile candidate. Not inferred owner data.
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--panel-strong)] p-4 text-sm">
                  <div className="font-bold text-[var(--text)]">{bestContact.title ?? bestContact.source ?? "Source"}</div>
                  {bestContact.url ? (
                    <a href={bestContact.url} target="_blank" rel="noreferrer" className="mt-2 block break-all font-semibold text-[var(--accent)]">
                      {bestContact.url}
                    </a>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-[var(--panel-strong)] px-4 py-8 text-center text-sm font-medium text-[var(--muted)]">
                No explicit public contact candidate yet. The worker keeps evidence and negative results for strategy tuning.
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              ["Queries", metricNumber(latestRun?.metrics, "queryCount")],
              ["Results", metricNumber(latestRun?.metrics, "resultCount")],
              ["Matches", metricNumber(latestRun?.metrics, "vehicleMatchCount")],
              ["Contacts", metricNumber(latestRun?.metrics, "contactCandidateCount")],
            ].map(([label, value]) => (
              <div key={label} className="dashboard-panel p-5">
                <div className="text-xs font-bold uppercase text-[var(--muted)]">{label}</div>
                <div className="mt-3 text-3xl font-bold tabular-nums text-[var(--text)]">{value}</div>
              </div>
            ))}
          </section>

          <section className="dashboard-panel overflow-hidden">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-base font-bold text-[var(--text)]">Evidence trail</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {!latestRun ? (
                <div className="px-5 py-8 text-center text-sm font-medium text-[var(--muted)]">No experiment run yet.</div>
              ) : (
                latestRun.searchRuns.flatMap((searchRun) =>
                  searchRun.queries.map((query) => (
                    <div key={`${searchRun.provider}-${query.query}`} className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-[var(--text)]">{query.query}</div>
                          <div className="mt-1 text-xs font-semibold text-[var(--muted)]">
                            {searchRun.provider} · {query.resultCount} results · {query.vehicleMatchCount} matches · contact {query.contactFound ? "yes" : "no"}
                          </div>
                        </div>
                        <span className="rounded-full bg-[var(--panel-strong)] px-2.5 py-1 text-xs font-bold text-[var(--muted-strong)]">
                          {searchRun.status}
                        </span>
                      </div>
                      {query.results.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {query.results.map((result) => (
                            <div key={`${result.source}-${result.url ?? result.title}`} className="rounded-xl bg-[var(--panel-strong)] p-3 text-sm">
                              <div className="font-bold text-[var(--text)]">{result.title ?? result.source}</div>
                              {result.url ? (
                                <a href={result.url} target="_blank" rel="noreferrer" className="mt-1 block break-all font-semibold text-[var(--accent)]">
                                  {result.url}
                                </a>
                              ) : null}
                              {result.snippet ? <div className="mt-2 line-clamp-2 text-[var(--muted-strong)]">{result.snippet}</div> : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )),
                )
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
