import { Plate } from "@/components/Plate";
import { formatCardDate } from "@/lib/date";
import { thumbKey } from "@/lib/s3-keys";
import Link from "next/link";

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

      <Link href={`/garage/${v.id}`} className="block p-4 focus:outline-none focus:ring-4 focus:ring-blue-500/10">
        <div className="vehicle-card-plate flex justify-center">
          <Plate value={v.licensePlateNormalized} />
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
      </Link>
    </article>
  );
}
