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
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
            Рабочая база
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[var(--text)]">Гараж</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Автомобили, добавленные менеджерами через Telegram-бота.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-white p-2 shadow-card">
          <SearchBar initial={rawQuery} />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-y border-[var(--border)] py-3">
        <div className="text-sm font-semibold text-[var(--text)]">
          Найдено: <span className="tabular-nums">{total}</span>
        </div>
        {rawQuery && (
          <Link
            href="/garage"
            className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            Сбросить поиск
          </Link>
        )}
      </div>

      {vehicles.length === 0 ? (
        <div className="grid min-h-[320px] place-items-center rounded-lg border border-dashed border-slate-300 bg-white/70 p-8 text-center">
          <div>
            <div className="text-lg font-semibold text-[var(--text)]">
              {rawQuery ? "Ничего не найдено" : "Гараж пока пуст"}
            </div>
            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
              {rawQuery
                ? `По запросу «${rawQuery}» нет сохраненных автомобилей.`
                : "Отправьте фото автомобиля с видимым госномером в Telegram-бота."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {vehicles.map((v) => (
            <VehicleCard key={v.id} v={v} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2 text-sm">
          {page > 1 && (
            <Link
              href={`/garage?${new URLSearchParams({
                ...(rawQuery ? { q: rawQuery } : {}),
                page: String(page - 1),
              })}`}
              className="rounded-md border border-[var(--border)] bg-white px-3 py-2 font-semibold transition hover:bg-slate-50"
            >
              Назад
            </Link>
          )}
          <span className="rounded-md bg-white px-3 py-2 font-semibold text-[var(--muted)] shadow-card">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/garage?${new URLSearchParams({
                ...(rawQuery ? { q: rawQuery } : {}),
                page: String(page + 1),
              })}`}
              className="rounded-md border border-[var(--border)] bg-white px-3 py-2 font-semibold transition hover:bg-slate-50"
            >
              Вперед
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
