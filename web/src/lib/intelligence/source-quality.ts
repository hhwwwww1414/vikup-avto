import type { SourceHit } from "./types";

const USEFUL_CONFIDENCE_MIN = 0.45;

export function isUsefulSourceHit(hit: SourceHit): boolean {
  if (hit.publicPhone || hit.publicEmail) return true;
  if (hit.plate || hit.vin) return true;
  return (hit.confidence ?? 0) >= USEFUL_CONFIDENCE_MIN;
}

function rankScore(hit: SourceHit): number {
  let score = hit.confidence ?? 0;
  if (hit.plate) score += 0.3;
  if (hit.vin) score += 0.25;
  if (hit.publicPhone) score += 0.2;
  if (hit.publicEmail) score += 0.12;
  return score;
}

export function rankSourceHits(hits: SourceHit[]): SourceHit[] {
  return [...hits].sort((a, b) => rankScore(b) - rankScore(a));
}
