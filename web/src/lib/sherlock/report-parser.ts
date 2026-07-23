export const SHERLOCK_PARSER_VERSION = 1;
export const SHERLOCK_PHONE_SOURCE = "SHERLOCK_REPORT";

export interface SherlockPhoneCandidate {
  phone: string;
  providerConfidence: number;
  rank: number;
  source?: typeof SHERLOCK_PHONE_SOURCE;
  fetchedAt?: string;
}

export interface ParsedSherlockReport {
  parserVersion: number;
  searchedPlate: string | null;
  vin: string | null;
  vehicleInfo: Record<string, string>;
  phoneCandidates: Required<SherlockPhoneCandidate>[];
  topPhoneCandidates: Required<SherlockPhoneCandidate>[];
  bestPhone: string | null;
  bestProviderConfidence: number | null;
  hasMultipleTopCandidates: boolean;
  reportUrl: string | null;
}

interface ParseOptions {
  searchedPlate?: string;
  reportUrl?: string | null;
  fetchedAt?: Date;
}

const PHONE_WITH_CONFIDENCE =
  /(?:\+?7|8)[\s().-]*(\d{3})[\s().-]*(\d{3})[\s().-]*(\d{2})[\s().-]*(\d{2})(?!\d).{0,80}?(\d+(?:[.,]\d+)?)\s*%/giu;
const CLIPBOARD_PHONE_WITH_CONFIDENCE =
  /data-clipboard-text=["'](?:\+?7|8)[\s().-]*(\d{3})[\s().-]*(\d{3})[\s().-]*(\d{2})[\s().-]*(\d{2})["'][\s\S]{0,800}?(\d+(?:[.,]\d+)?)\s*%/giu;
const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/iu;
const PLATE_RE = /(?:госномер|номер|plate)\s*[:\-]?\s*([A-ZА-Я]\s*\d{3}\s*[A-ZА-Я]{2}\s*\d{2,3})/iu;

function parseConfidence(raw: string): number {
  return Number(raw.replace(",", "."));
}

function uniqueCandidates(candidates: SherlockPhoneCandidate[]): SherlockPhoneCandidate[] {
  const byPhone = new Map<string, SherlockPhoneCandidate>();
  for (const candidate of candidates) {
    const existing = byPhone.get(candidate.phone);
    if (!existing || candidate.providerConfidence > existing.providerConfidence) {
      byPhone.set(candidate.phone, candidate);
    }
  }
  return Array.from(byPhone.values())
    .sort((a, b) => b.providerConfidence - a.providerConfidence || a.rank - b.rank)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

export function pickTopPhoneCandidates<T extends SherlockPhoneCandidate>(
  candidates: T[],
): T[] {
  if (candidates.length === 0) return [];
  const max = Math.max(...candidates.map((candidate) => candidate.providerConfidence));
  return candidates.filter((candidate) => candidate.providerConfidence === max);
}

function inferReportExtension(contentType: string): string {
  const type = contentType.toLowerCase().split(";")[0].trim();
  if (type === "application/pdf") return "pdf";
  if (type === "text/html") return "html";
  if (type === "application/json") return "json";
  if (type === "text/plain") return "txt";
  return "bin";
}

export function buildSherlockReportKey(
  vehicleId: string,
  lookupId: string,
  contentType: string,
): string {
  return `sherlock/${vehicleId}/${lookupId}/report.${inferReportExtension(contentType)}`;
}

export function parseSherlockReport(raw: string, options: ParseOptions = {}): ParsedSherlockReport {
  const fetchedAt = (options.fetchedAt ?? new Date()).toISOString();
  const candidates: SherlockPhoneCandidate[] = [];
  let match: RegExpExecArray | null;

  for (const pattern of [CLIPBOARD_PHONE_WITH_CONFIDENCE, PHONE_WITH_CONFIDENCE]) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(raw)) !== null) {
      const phone = `7${match[1]}${match[2]}${match[3]}${match[4]}`;
      const providerConfidence = parseConfidence(match[5]);
      if (phone.length === 11 && phone.startsWith("7") && Number.isFinite(providerConfidence)) {
        candidates.push({
          phone,
          providerConfidence,
          rank: candidates.length + 1,
        });
      }
    }
  }

  const ranked: Required<SherlockPhoneCandidate>[] = uniqueCandidates(candidates).map((candidate) => ({
    ...candidate,
    source: SHERLOCK_PHONE_SOURCE,
    fetchedAt,
  }));
  const topPhoneCandidates = pickTopPhoneCandidates(ranked);
  const best = topPhoneCandidates.length === 1 ? topPhoneCandidates[0] : null;
  const vin = raw.match(VIN_RE)?.[1]?.toUpperCase() ?? null;
  const searchedPlate =
    options.searchedPlate ?? raw.match(PLATE_RE)?.[1]?.replace(/\s+/g, "").toUpperCase() ?? null;

  return {
    parserVersion: SHERLOCK_PARSER_VERSION,
    searchedPlate,
    vin,
    vehicleInfo: {},
    phoneCandidates: ranked,
    topPhoneCandidates,
    bestPhone: best?.phone ?? null,
    bestProviderConfidence: best?.providerConfidence ?? null,
    hasMultipleTopCandidates: topPhoneCandidates.length > 1,
    reportUrl: options.reportUrl ?? null,
  };
}
