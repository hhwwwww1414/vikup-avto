import { prisma } from "@/lib/db";
import { ManagersClient, type ManagerRow } from "./ManagersClient";

export const dynamic = "force-dynamic";

export default async function ManagersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      login: true,
      role: true,
      telegramId: true,
      isActive: true,
      _count: { select: { vehicles: true } },
    },
  });

  const rows: ManagerRow[] = users.map((u: (typeof users)[number]) => ({
    id: u.id,
    name: u.name,
    login: u.login,
    role: u.role,
    telegramId: u.telegramId ? u.telegramId.toString() : null,
    isActive: u.isActive,
    vehicles: u._count.vehicles,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
          Администрирование
        </div>
        <h1 className="mt-1 text-3xl font-black tracking-tight">Менеджеры</h1>
      </div>
      <ManagersClient rows={rows} />
    </div>
  );
}
