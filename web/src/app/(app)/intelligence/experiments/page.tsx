import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function metricNumber(metrics: unknown, key: string): number | null {
  if (!metrics || typeof metrics !== "object") return null;
  const value = (metrics as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pct(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function formatMs(value: number | null): string {
  if (value === null) return "-";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} s`;
}

export default async function IntelligenceExperimentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/garage");

  const [totalRuns, doneRuns, failedRuns, pendingJobs, runningJobs, latestRuns] =
    await Promise.all([
      prisma.experimentRun.count(),
      prisma.experimentRun.count({ where: { status: "DONE" } }),
      prisma.experimentRun.count({ where: { status: "FAILED" } }),
      prisma.intelligenceJob.count({ where: { status: "PENDING" } }),
      prisma.intelligenceJob.count({ where: { status: "RUNNING" } }),
      prisma.experimentRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 20,
        select: {
          id: true,
          strategy: true,
          strategyVersion: true,
          status: true,
          metrics: true,
          startedAt: true,
          finishedAt: true,
          vehicle: {
            select: {
              licensePlateNormalized: true,
            },
          },
          searchRuns: {
            select: {
              provider: true,
              status: true,
            },
          },
        },
      }),
    ]);

  const vehicleMatchRuns = latestRuns.filter((run) => (metricNumber(run.metrics, "vehicleMatchCount") ?? 0) > 0).length;
  const contactRuns = latestRuns.filter((run) => run.metrics && (run.metrics as Record<string, unknown>).contactFound === true).length;
  const avgRuntime =
    latestRuns.length === 0
      ? null
      : Math.round(
          latestRuns.reduce((sum, run) => sum + (metricNumber(run.metrics, "latencyMs") ?? 0), 0) /
            latestRuns.length,
        );

  const metrics = [
    { label: "Experiment runs", value: totalRuns, tone: "bg-blue-50 text-blue-700" },
    { label: "Done", value: doneRuns, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Failed", value: failedRuns, tone: "bg-red-50 text-red-700" },
    { label: "Queued jobs", value: pendingJobs + runningJobs, tone: "bg-slate-100 text-slate-700" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Vehicle Intelligence</h1>
        <p className="mt-2 max-w-3xl text-sm font-medium text-[var(--muted)]">
          Research dashboard for asynchronous vehicle intelligence experiments.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <section key={m.label} className="dashboard-panel p-5">
            <div className={`mb-5 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${m.tone}`}>{m.label}</div>
            <div className="text-3xl font-bold tracking-tight tabular-nums text-[var(--text)]">{m.value}</div>
          </section>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="dashboard-panel p-5">
          <div className="text-xs font-bold uppercase text-[var(--muted)]">Vehicle trace recall</div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-[var(--text)]">{pct(vehicleMatchRuns, latestRuns.length)}</div>
          <div className="mt-1 text-sm font-medium text-[var(--muted)]">{vehicleMatchRuns} / {latestRuns.length} latest runs</div>
        </section>
        <section className="dashboard-panel p-5">
          <div className="text-xs font-bold uppercase text-[var(--muted)]">Contact discovery</div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-[var(--text)]">{pct(contactRuns, latestRuns.length)}</div>
          <div className="mt-1 text-sm font-medium text-[var(--muted)]">Only explicit public contacts count</div>
        </section>
        <section className="dashboard-panel p-5">
          <div className="text-xs font-bold uppercase text-[var(--muted)]">Average runtime</div>
          <div className="mt-3 text-3xl font-bold tabular-nums text-[var(--text)]">{formatMs(avgRuntime)}</div>
          <div className="mt-1 text-sm font-medium text-[var(--muted)]">Latest {latestRuns.length} runs</div>
        </section>
      </div>

      <section className="dashboard-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-base font-bold text-[var(--text)]">Latest runs</h2>
          <span className="text-xs font-semibold text-[var(--muted)]">baseline metrics</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
              <tr className="text-left">
                <th className="px-5 py-3 font-bold">Vehicle</th>
                <th className="px-5 py-3 font-bold">Strategy</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">Queries</th>
                <th className="px-5 py-3 font-bold">Results</th>
                <th className="px-5 py-3 font-bold">Matches</th>
                <th className="px-5 py-3 font-bold">Contact</th>
                <th className="px-5 py-3 font-bold">Runtime</th>
                <th className="px-5 py-3 font-bold">Providers</th>
              </tr>
            </thead>
            <tbody>
              {latestRuns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-sm font-medium text-[var(--muted)]">
                    No experiment runs yet. Start the worker after deploying the migration.
                  </td>
                </tr>
              ) : (
                latestRuns.map((run) => (
                  <tr key={run.id} className="border-t border-[var(--border)]">
                    <td className="px-5 py-4 font-bold text-[var(--text)]">{run.vehicle.licensePlateNormalized}</td>
                    <td className="px-5 py-4 font-medium text-[var(--muted-strong)]">
                      {run.strategy} v{run.strategyVersion}
                    </td>
                    <td className="px-5 py-4 font-bold text-[var(--text)]">{run.status}</td>
                    <td className="px-5 py-4 tabular-nums">{metricNumber(run.metrics, "queryCount") ?? 0}</td>
                    <td className="px-5 py-4 tabular-nums">{metricNumber(run.metrics, "resultCount") ?? 0}</td>
                    <td className="px-5 py-4 tabular-nums">{metricNumber(run.metrics, "vehicleMatchCount") ?? 0}</td>
                    <td className="px-5 py-4">{run.metrics && (run.metrics as Record<string, unknown>).contactFound ? "yes" : "no"}</td>
                    <td className="px-5 py-4 tabular-nums">{formatMs(metricNumber(run.metrics, "latencyMs"))}</td>
                    <td className="px-5 py-4 text-[var(--muted-strong)]">
                      {run.searchRuns.map((searchRun) => `${searchRun.provider}:${searchRun.status}`).join(", ") || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
