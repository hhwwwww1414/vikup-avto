import { Plate } from "@/components/Plate";
import { formatCardDate } from "@/lib/date";
import { thumbKey } from "@/lib/s3-keys";
import { RetrySherlockButton } from "./RetrySherlockButton";

export interface VehicleView {
  id: string;
  photoKey: string;
  licensePlateNormalized: string;
  managerName: string;
  createdAt: Date;
  sherlockLookupStatus: string | null;
  sherlockBestPhone: string | null;
  sherlockBestProviderConfidence: number | null;
  sherlockHasMultipleTopCandidates: boolean;
  sherlockReportId: string | null;
  sherlockPhoneCandidates: Array<{
    phone: string;
    providerConfidence: number;
    rank: number;
  }>;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 11 || !digits.startsWith("7")) return phone;
  return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
}

function formatConfidence(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function statusLabel(status: string | null): string {
  if (status === "PENDING" || status === "RUNNING" || status === "WAITING_REPORT" || status === "PARSING") {
    return "Ищем контакт...";
  }
  if (status === "FAILED") return "Поиск не удался";
  if (status === "DONE") return "Контакты не найдены";
  return "Поиск ожидает";
}

export function VehicleCard({ v }: { v: VehicleView }) {
  const src = `/api/image?key=${encodeURIComponent(thumbKey(v.photoKey))}`;
  const full = `/api/image?key=${encodeURIComponent(v.photoKey)}`;
  const topConfidence = v.sherlockPhoneCandidates[0]?.providerConfidence ?? null;
  const primaryCandidates = v.sherlockBestPhone
    ? v.sherlockPhoneCandidates.filter((candidate) => candidate.phone === v.sherlockBestPhone)
    : v.sherlockPhoneCandidates.filter((candidate) => candidate.providerConfidence === topConfidence);
  const hasContact = primaryCandidates.length > 0;
  const alternatives = v.sherlockPhoneCandidates.filter(
    (candidate) => !primaryCandidates.some((primary) => primary.phone === candidate.phone),
  );

  return (
    <article className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-card">
      <a href={full} target="_blank" rel="noreferrer" className="block focus:outline-none focus:ring-4 focus:ring-blue-500/10">
        <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={v.licensePlateNormalized}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        </div>
      </a>

      <div className="p-4">
        <div className="vehicle-card-plate flex justify-center">
          <Plate value={v.licensePlateNormalized} />
        </div>
        <div className="mt-4 rounded-xl border border-[var(--border)] bg-slate-50 p-3">
          <div className="text-[11px] font-black uppercase tracking-wide text-[var(--muted)]">
            Контакт
          </div>
          {hasContact ? (
            <div className="mt-2">
              <div className="space-y-1">
                {primaryCandidates.map((candidate) => (
                  <div key={candidate.phone} className="text-base font-black text-[var(--text)]">
                    {formatPhone(candidate.phone)}
                  </div>
                ))}
              </div>
              <div className="mt-1 text-xs font-semibold text-[var(--muted-strong)]">
                Sherlock confidence: {formatConfidence(topConfidence ?? v.sherlockBestProviderConfidence ?? 0)}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">Источник: Sherlock Report</div>
              {v.sherlockHasMultipleTopCandidates || primaryCandidates.length > 1 ? (
                <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-800">
                  Несколько номеров имеют одинаковый maximum confidence.
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-sm font-bold text-[var(--muted-strong)]">
              {statusLabel(v.sherlockLookupStatus)}
            </div>
          )}

          {alternatives.length > 0 ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-bold text-[var(--accent)]">
                Другие найденные номера
              </summary>
              <div className="mt-2 space-y-1 text-xs text-[var(--muted-strong)]">
                {alternatives.map((candidate) => (
                  <div key={candidate.phone} className="flex justify-between gap-2">
                    <span>{formatPhone(candidate.phone)}</span>
                    <span>{formatConfidence(candidate.providerConfidence)}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {v.sherlockReportId ? (
              <a
                href={`/api/sherlock/reports/${v.sherlockReportId}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--accent-hover)]"
              >
                Открыть полный отчет
              </a>
            ) : null}
            <RetrySherlockButton vehicleId={v.id} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[var(--text)]">{v.managerName}</div>
            <div className="mt-0.5 text-xs font-medium text-[var(--muted)]">{formatCardDate(v.createdAt)}</div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            В базе
          </span>
        </div>
      </div>
    </article>
  );
}
