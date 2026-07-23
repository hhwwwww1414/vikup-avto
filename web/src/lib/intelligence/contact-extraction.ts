export interface PublicContactCandidate {
  kind: "phone" | "email";
  value: string;
  confidence: number;
  signals: string[];
}

const LISTING_DOMAINS = [
  "auto.ru",
  "avito.ru",
  "drom.ru",
  "youla.ru",
  "cars.ru",
  "am.ru",
  "bibika.ru",
  "autospot.ru",
  "major-auto.ru",
  "rolf.ru",
  "avilon.ru",
  "fresh-auto.ru",
];

const LISTING_WORDS = [
  "авто",
  "автомобиль",
  "продажа",
  "продается",
  "продаётся",
  "купить",
  "объявление",
  "дилер",
  "автосалон",
  "trade-in",
  "трейд-ин",
  "пробег",
  "vin",
];

const RU_PHONE_REGEX = /(?:\+7|8)[\s\-.(]*\d{3}[\s\-.)]*\d{3}[\s\-.]*\d{2}[\s\-.]*\d{2}/g;
const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

function hostOf(rawUrl?: string): string {
  if (!rawUrl) return "";
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  return value.trim();
}

export function isPublicVehicleSaleContext(input: {
  url?: string;
  title?: string;
  snippet?: string;
}): { ok: boolean; signals: string[] } {
  const host = hostOf(input.url);
  const text = `${input.title ?? ""} ${input.snippet ?? ""}`.toLowerCase();
  const signals: string[] = [];

  if (LISTING_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
    signals.push("known_vehicle_listing_domain");
  }
  for (const word of LISTING_WORDS) {
    if (text.includes(word)) signals.push(`vehicle_context:${word}`);
  }

  return { ok: signals.length > 0, signals };
}

export function extractPublicContacts(input: {
  url?: string;
  title?: string;
  snippet?: string;
}): PublicContactCandidate[] {
  const context = isPublicVehicleSaleContext(input);
  if (!context.ok) return [];

  const text = `${input.title ?? ""}\n${input.snippet ?? ""}`;
  const seen = new Set<string>();
  const out: PublicContactCandidate[] = [];

  for (const match of text.matchAll(RU_PHONE_REGEX)) {
    const value = normalizePhone(match[0]);
    if (seen.has(value)) continue;
    seen.add(value);
    out.push({
      kind: "phone",
      value,
      confidence: context.signals.includes("known_vehicle_listing_domain") ? 0.72 : 0.55,
      signals: ["explicit_public_phone", ...context.signals],
    });
  }

  for (const match of text.matchAll(EMAIL_REGEX)) {
    const value = match[0].toLowerCase();
    if (seen.has(value)) continue;
    seen.add(value);
    out.push({
      kind: "email",
      value,
      confidence: context.signals.includes("known_vehicle_listing_domain") ? 0.68 : 0.5,
      signals: ["explicit_public_email", ...context.signals],
    });
  }

  return out;
}
