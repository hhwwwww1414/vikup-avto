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
    { label: "Всего автомобилей", value: totalVehicles },
    { label: "Сегодня", value: todayCount },
    { label: "За 7 дней", value: weekCount },
    { label: "Активных менеджеров", value: activeManagers },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
          Сводка
        </div>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Аналитика</h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <section
            key={m.label}
            className="rounded-lg border border-[var(--border)] bg-white p-4 shadow-card"
          >
            <div className="text-3xl font-black tracking-tight tabular-nums">{m.value}</div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              {m.label}
            </div>
          </section>
        ))}
      </div>

      <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-card">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold">Результат по менеджерам</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-[var(--panel-strong)]">
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                <th className="px-4 py-3 font-bold">Менеджер</th>
                <th className="px-4 py-3 font-bold">Всего</th>
                <th className="px-4 py-3 font-bold">Сегодня</th>
                <th className="px-4 py-3 font-bold">За 7 дней</th>
              </tr>
            </thead>
            <tbody>
              {perManager.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                    Пока нет данных.
                  </td>
                </tr>
              ) : (
                perManager.map((r: ManagerStatRow) => (
                  <tr key={r.name} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3 font-semibold">{r.name}</td>
                    <td className="px-4 py-3 tabular-nums">{Number(r.total)}</td>
                    <td className="px-4 py-3 tabular-nums">{Number(r.today)}</td>
                    <td className="px-4 py-3 tabular-nums">{Number(r.week)}</td>
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
