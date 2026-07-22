import { randomUUID } from "crypto";

/** Pure S3 key helpers — no SDK, safe to import from components. */

/** Derive the thumbnail key for a given original key. */
export function thumbKey(originalKey: string): string {
  return originalKey.replace(/\.jpg$/i, ".thumb.jpg");
}

/** Build the object key: vehicles/YYYY/MM/{uuid}.jpg */
export function buildVehicleKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `vehicles/${y}/${m}/${randomUUID()}.jpg`;
}

/** Only allow serving objects under the vehicles/ prefix through the proxy. */
export function isAllowedKey(key: string): boolean {
  return /^vehicles\/\d{4}\/\d{2}\/[a-f0-9-]+(\.thumb)?\.jpg$/i.test(key);
}
