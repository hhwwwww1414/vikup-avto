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
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-card">
      <a href={full} target="_blank" rel="noreferrer" className="block">
        <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--bg)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={v.licensePlateNormalized}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      </a>
      <div className="space-y-1.5 p-3">
        <Plate value={v.licensePlateNormalized} className="text-lg" />
        <div className="text-sm font-medium text-graphite">{v.managerName}</div>
        <div className="text-xs text-[var(--muted)]">{formatCardDate(v.createdAt)}</div>
      </div>
    </div>
  );
}
