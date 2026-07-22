import Link from "next/link";
import { prisma } from "@/lib/db";
import { normalizePlateInput } from "@/lib/plate";
import { SearchBar } from "./SearchBar";
import { VehicleCard, type VehicleView } from "./VehicleCard";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

export default async function GaragePage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const rawQuery = (searchParams.q ?? "").trim();
  const normalizedQuery = normalizePlateInput(rawQuery);
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where =
    normalizedQuery.length > 0
      ? { licensePlateNormalized: { contains: normalizedQuery } }
      : {};

  const [rows, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        photoKey: true,
        licensePlateNormalized: true,
        createdAt: true,
        manager: { select: { name: true } },
      },
    }),
    prisma.vehicle.count({ where }),
  ]);

  const vehicles: VehicleView[] = rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    photoKey: r.photoKey,
    licensePlateNormalized: r.licensePlateNormalized,
    managerName: r.manager.name,
    createdAt: r.createdAt,
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Гараж</h1>
        <div className="text-sm text-[var(--muted)]">Всего: {total}</div>
      </div>

      <div className="mb-6">
        <SearchBar initial={rawQuery} />
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--panel)] p-10 text-center text-[var(--muted)]">
          {rawQuery
            ? `По запросу «${rawQuery}» ничего не найдено.`
            : "Пока нет автомобилей. Отправьте фото госномера в Telegram-бота."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {vehicles.map((v) => (
            <VehicleCard key={v.id} v={v} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`/garage?${new URLSearchParams({
                ...(rawQuery ? { q: rawQuery } : {}),
                page: String(page - 1),
              })}`}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 hover:bg-black/5"
            >
              Назад
            </Link>
          )}
          <span className="text-[var(--muted)]">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/garage?${new URLSearchParams({
                ...(rawQuery ? { q: rawQuery } : {}),
                page: String(page + 1),
              })}`}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 hover:bg-black/5"
            >
              Вперёд
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
