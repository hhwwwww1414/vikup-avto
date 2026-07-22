import "server-only";
import { env } from "./env";
import { log } from "./logger";
import { parseRussianPlateCandidates, type PlateResult } from "./plate";

export interface OcrResponse {
  plate: string | null; // raw best OCR string (latin/mixed)
  candidates?: string[]; // additional raw OCR variants, best first
  confidence: number;
  found: boolean; // was a plate region detected
  ms: number;
}

/**
 * Call the local ANPR service with the original image bytes. The service does
 * detection + crop + perspective + OCR and returns the best raw plate string
 * plus a confidence. Russian normalization/validation happens here so the JS
 * side stays the single source of truth for the plate format.
 */
export async function recognizePlate(
  image: Buffer,
): Promise<{ ocr: OcrResponse; plate: PlateResult | null }> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([Uint8Array.from(image)], { type: "image/jpeg" }),
    "photo.jpg",
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${env.ocrUrl}/recognize`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      log.warn("ocr.http.failed", { status: res.status });
      return { ocr: { plate: null, confidence: 0, found: false, ms: 0 }, plate: null };
    }
    const ocr = (await res.json()) as OcrResponse;

    if (!ocr.found || !ocr.plate || ocr.confidence < env.ocrConfidenceMin) {
      return { ocr, plate: null };
    }

    const rawCandidates = [ocr.plate, ...(ocr.candidates ?? [])].filter(
      (p): p is string => Boolean(p),
    );
    const plate = parseRussianPlateCandidates(rawCandidates);
    return { ocr, plate };
  } catch (e) {
    log.warn("ocr.error", { err: String(e) });
    return { ocr: { plate: null, confidence: 0, found: false, ms: 0 }, plate: null };
  } finally {
    clearTimeout(timeout);
  }
}
