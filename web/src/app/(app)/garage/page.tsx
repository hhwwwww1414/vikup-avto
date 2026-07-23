import Link from "next/link";
import { prisma } from "@/lib/db";
import { normalizePlateInput } from "@/lib/plate";
import { GarageAutoRefresh } from "./GarageAutoRefresh";
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
        sherlockLookupStatus: true,
        sherlockBestPhone: true,
        sherlockBestProviderConfidence: true,
        sherlockHasMultipleTopCandidates: true,
        manager: { select: { name: true } },
        sherlockReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true },
        },
        sherlockPhoneCandidates: {
          orderBy: { rank: "asc" },
          take: 6,
          select: {
            phone: true,
            providerConfidence: true,
            rank: true,
          },
        },
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
    sherlockLookupStatus: r.sherlockLookupStatus,
    sherlockBestPhone: r.sherlockBestPhone,
    sherlockBestProviderConfidence: r.sherlockBestProviderConfidence,
    sherlockHasMultipleTopCandidates: r.sherlockHasMultipleTopCandidates,
    sherlockReportId: r.sherlockReports[0]?.id ?? null,
    sherlockPhoneCandidates: r.sherlockPhoneCandidates,
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl">
      <GarageAutoRefresh />
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">Гараж</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
            <span className="rounded-full bg-white px-3 py-1 font-semibold shadow-sm ring-1 ring-[var(--border)]">
              {total} авто
            </span>
            {rawQuery ? (
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 font-semibold text-[var(--accent)]">
                Фильтр: {rawQuery}
              </span>
            ) : null}
          </div>
        </div>
        <div className="w-full xl:max-w-xl">
          <SearchBar initial={rawQuery} />
        </div>
      </div>

      {rawQuery && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm">
          <span className="min-w-0 truncate text-sm font-medium text-[var(--muted-strong)]">
            Показаны совпадения по запросу <span className="font-bold text-[var(--text)]">{rawQuery}</span>
          </span>
          <Link href="/garage" className="shrink-0 text-sm font-bold text-[var(--accent)] hover:text-[var(--accent-hover)]">
            Сбросить
          </Link>
        </div>
      )}

      {vehicles.length === 0 ? (
        <div className="dashboard-panel grid min-h-[260px] place-items-center p-8 text-center">
          <div>
            <div className="text-lg font-bold">{rawQuery ? "Ничего не найдено" : "Пока пусто"}</div>
            <div className="mt-2 text-sm text-[var(--muted)]">
              {rawQuery ? "Попробуйте другой номер или регион." : "Новые автомобили появятся здесь после загрузки."}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {vehicles.map((v) => (
            <VehicleCard key={v.id} v={v} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={`/garage?${new URLSearchParams({
                ...(rawQuery ? { q: rawQuery } : {}),
                page: String(page - 1),
              })}`}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 font-bold text-[var(--text)] shadow-sm transition hover:border-[var(--border-strong)]"
            >
              Назад
            </Link>
          )}
          <span className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 font-bold text-[var(--muted-strong)] shadow-sm">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/garage?${new URLSearchParams({
                ...(rawQuery ? { q: rawQuery } : {}),
                page: String(page + 1),
              })}`}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 font-bold text-[var(--text)] shadow-sm transition hover:border-[var(--border-strong)]"
            >
              Вперёд
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
