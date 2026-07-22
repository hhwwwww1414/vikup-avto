import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ManagerStatRow {
  name: string;
  total: bigint;
  today: bigint;
  week: bigint;
}

function startOfToday(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export default async function AnalyticsPage() {
  const today = startOfToday();
  const weekAgo = new Date(today.getTime() - 6 * 86_400_000);

  const [totalVehicles, todayCount, weekCount, activeManagers, perManager] =
    await Promise.all([
      prisma.vehicle.count(),
      prisma.vehicle.count({ where: { createdAt: { gte: today } } }),
      prisma.vehicle.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { isActive: true, role: "MANAGER" } }),
      prisma.$queryRaw<ManagerStatRow[]>`
        SELECT u.name AS name,
          COUNT(v.id) AS total,
          COUNT(v.id) FILTER (WHERE v.created_at >= ${today}) AS today,
          COUNT(v.id) FILTER (WHERE v.created_at >= ${weekAgo}) AS week
        FROM users u
        LEFT JOIN vehicles v ON v.manager_id = u.id
        GROUP BY u.id, u.name
        HAVING COUNT(v.id) > 0
        ORDER BY total DESC, u.name ASC
      `,
    ]);

  const metrics = [
    { label: "Всего авто", value: totalVehicles, tone: "bg-blue-50 text-blue-700" },
    { label: "Сегодня", value: todayCount, tone: "bg-emerald-50 text-emerald-700" },
    { label: "За 7 дней", value: weekCount, tone: "bg-indigo-50 text-indigo-700" },
    { label: "Активные менеджеры", value: activeManagers, tone: "bg-slate-100 text-slate-700" },
  ];
  const maxTotal = Math.max(1, ...perManager.map((r) => Number(r.total)));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Аналитика</h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <section key={m.label} className="dashboard-panel p-5">
            <div className={`mb-5 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${m.tone}`}>{m.label}</div>
            <div className="text-3xl font-bold tracking-tight tabular-nums text-[var(--text)]">{m.value}</div>
          </section>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="dashboard-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <h2 className="text-base font-bold text-[var(--text)]">Менеджеры</h2>
            <span className="text-xs font-semibold text-[var(--muted)]">по количеству авто</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-[var(--panel-strong)] text-xs uppercase text-[var(--muted)]">
                <tr className="text-left">
                  <th className="px-5 py-3 font-bold">Менеджер</th>
                  <th className="px-5 py-3 font-bold">Всего</th>
                  <th className="px-5 py-3 font-bold">Сегодня</th>
                  <th className="px-5 py-3 font-bold">7 дней</th>
                </tr>
              </thead>
              <tbody>
                {perManager.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-sm font-medium text-[var(--muted)]">
                      Нет данных
                    </td>
                  </tr>
                ) : (
                  perManager.map((r: ManagerStatRow) => (
                    <tr key={r.name} className="border-t border-[var(--border)]">
                      <td className="px-5 py-4 font-bold text-[var(--text)]">{r.name}</td>
                      <td className="px-5 py-4 font-semibold tabular-nums text-[var(--text)]">{Number(r.total)}</td>
                      <td className="px-5 py-4 font-medium tabular-nums text-[var(--muted-strong)]">{Number(r.today)}</td>
                      <td className="px-5 py-4 font-medium tabular-nums text-[var(--muted-strong)]">{Number(r.week)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dashboard-panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--text)]">Вклад</h2>
            <span className="text-xs font-semibold text-[var(--muted)]">total</span>
          </div>
          <div className="space-y-4">
            {perManager.length === 0 ? (
              <div className="rounded-2xl bg-[var(--panel-strong)] px-4 py-8 text-center text-sm font-medium text-[var(--muted)]">
                Нет данных
              </div>
            ) : (
              perManager.slice(0, 8).map((r) => {
                const value = Number(r.total);
                return (
                  <div key={r.name}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-semibold text-[var(--text)]">{r.name}</span>
                      <span className="font-bold tabular-nums text-[var(--muted-strong)]">{value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${Math.max(8, Math.round((value / maxTotal) * 100))}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
