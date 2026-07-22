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
    <div className="mx-auto max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Менеджеры</h1>
      </div>
      <ManagersClient rows={rows} />
    </div>
  );
}
