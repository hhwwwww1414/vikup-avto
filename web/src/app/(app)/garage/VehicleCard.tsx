import { Plate } from "@/components/Plate";
import { formatCardDate } from "@/lib/date";
import { thumbKey } from "@/lib/s3-keys";

export interface VehicleView {
  id: string;
  photoKey: string;
  licensePlateNormalized: string;
  managerName: string;
  createdAt: Date;
}

export function VehicleCard({ v }: { v: VehicleView }) {
  const src = `/api/image?key=${encodeURIComponent(thumbKey(v.photoKey))}`;
  const full = `/api/image?key=${encodeURIComponent(v.photoKey)}`;

  return (
    <article className="group overflow-hidden rounded-lg border border-[var(--border)] bg-white shadow-card transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
      <a href={full} target="_blank" rel="noreferrer" className="block focus:outline-none focus:ring-2 focus:ring-accent/30">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={v.licensePlateNormalized}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
          />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/52 to-transparent" />
        </div>
      </a>

      <div className="space-y-3 p-3.5">
        <Plate value={v.licensePlateNormalized} />
        <div className="flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[var(--text)]">{v.managerName}</div>
            <div className="mt-0.5 text-xs text-[var(--muted)]">{formatCardDate(v.createdAt)}</div>
          </div>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
        </div>
      </div>
    </article>
  );
}
