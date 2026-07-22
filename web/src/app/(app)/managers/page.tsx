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
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-5 text-2xl font-bold tracking-tight">Менеджеры</h1>
      <ManagersClient rows={rows} />
    </div>
  );
}
