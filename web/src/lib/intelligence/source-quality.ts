import type { SourceHit } from "./types";

const USEFUL_CONTACT_CONFIDENCE_MIN = 0.65;
const USEFUL_CONTEXT_CONFIDENCE_MIN = 0.7;

export function isUsefulSourceHit(hit: SourceHit): boolean {
  if (hit.plate || hit.vin) return true;
  if (hit.publicPhone || hit.publicEmail) return (hit.confidence ?? 0) >= USEFUL_CONTACT_CONFIDENCE_MIN;
  return (hit.confidence ?? 0) >= USEFUL_CONTEXT_CONFIDENCE_MIN;
}

export function isActionableContactHit(hit: SourceHit): boolean {
  if (!hit.publicPhone && !hit.publicEmail) return false;
  if (hit.plate || hit.vin) return true;
  return (hit.confidence ?? 0) >= USEFUL_CONTACT_CONFIDENCE_MIN;
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
