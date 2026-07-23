import { prisma } from "@/lib/db";
import { normalizePlateInput } from "@/lib/plate";
import type { SearchContext, SearchProvider, SourceHit } from "../types";

export class InternalHistoryProvider implements SearchProvider {
  name = "internal_history";

  async search(query: string, context: SearchContext): Promise<SourceHit[]> {
    const normalized = normalizePlateInput(query);
    if (!normalized) return [];

    const rows = await prisma.vehicle.findMany({
      where: {
        id: { not: context.vehicleId },
        licensePlateNormalized: normalized,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        photoKey: true,
        licensePlateNormalized: true,
        licensePlate: true,
        createdAt: true,
        manager: { select: { name: true } },
      },
    });

    return rows.map((row): SourceHit => ({
      source: this.name,
      url: `/garage?q=${encodeURIComponent(row.licensePlateNormalized)}`,
      title: `Internal vehicle ${row.licensePlateNormalized}`,
      snippet: `Existing Garage vehicle captured at ${row.createdAt.toISOString()}`,
      query,
      plate: row.licensePlateNormalized,
      fetchedAt: new Date(),
      raw: {
        vehicleId: row.id,
        photoKey: row.photoKey,
        licensePlate: row.licensePlate,
        licensePlateNormalized: row.licensePlateNormalized,
        managerName: row.manager.name,
        createdAt: row.createdAt.toISOString(),
      },
      normalized: {
        plate: row.licensePlateNormalized,
      },
      derived: {
        sameVehicleSignals: [
          { signal: "plate_exact", score: 90 },
          { signal: "internal_history", score: 10 },
        ],
      },
      confidence: 1,
    }));
  }
}
