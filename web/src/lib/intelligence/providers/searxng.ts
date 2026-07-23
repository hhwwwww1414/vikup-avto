import { env } from "@/lib/env";
import { normalizePlateInput } from "@/lib/plate";
import { extractPublicContacts, isPublicVehicleSaleContext } from "../contact-extraction";
import { rankSourceHits } from "../source-quality";
import type { SearchContext, SearchProvider, SourceHit } from "../types";

interface SearxngResult {
  url?: string;
  title?: string;
  content?: string;
  engine?: string;
  engines?: string[];
  category?: string;
  publishedDate?: string;
  img_src?: string;
  thumbnail?: string;
  parsed_url?: string[];
  [key: string]: unknown;
}

interface SearxngResponse {
  query?: string;
  number_of_results?: number;
  results?: SearxngResult[];
  answers?: unknown[];
  suggestions?: string[];
  unresponsive_engines?: unknown[];
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function samePlateSignal(hit: SearxngResult, plateNormalized: string): boolean {
  const text = normalizePlateInput(`${hit.title ?? ""} ${hit.content ?? ""}`);
  return text.includes(plateNormalized);
}

const PUBLIC_PAGE_FETCH_DOMAINS = [
  "auto.ru",
  "avito.ru",
  "drom.ru",
  "youla.ru",
  "cars.ru",
  "am.ru",
  "bibika.ru",
  "drive2.ru",
  "vin.drom.ru",
  "avtocod.ru",
  "avtonomer.net",
  "platesmania.com",
  "nomerogram.ru",
  "photocarsh.ru",
  "fototruck.ru",
];

const VIN_REGEX = /\b[A-HJ-NPR-Z0-9]{17}\b/g;

function hostOf(rawUrl?: string): string {
  if (!rawUrl) return "";
  try {
    return new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function publicPageFetchAllowed(rawUrl?: string): boolean {
  const host = hostOf(rawUrl);
  return PUBLIC_PAGE_FETCH_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPublicPageText(rawUrl?: string): Promise<{ text?: string; status?: number; error?: string }> {
  if (!publicPageFetchAllowed(rawUrl)) return {};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(env.searxngTimeoutMs, 4_000));

  try {
    const res = await fetch(rawUrl!, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "vikup-auto-research/1.0 (+public vehicle intelligence; no auth bypass)",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.toLowerCase().includes("text/html")) {
      return { status: res.status };
    }
    const html = (await res.text()).slice(0, 250_000);
    return { text: htmlToText(html), status: res.status };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timeout);
  }
}

function extractVin(text: string): string | undefined {
  for (const match of text.toUpperCase().matchAll(VIN_REGEX)) {
    const value = match[0];
    if (/[IOQ]/.test(value)) continue;
    return value;
  }
  return undefined;
}

function confidenceFor(input: {
  plateExact: boolean;
  vin?: string;
  contactConfidence?: number;
  vehicleContext: boolean;
  pageFetched: boolean;
}): number {
  let score = 0.12;
  if (input.vehicleContext) score += 0.18;
  if (input.plateExact) score += 0.5;
  if (input.vin) score += 0.18;
  if (input.pageFetched) score += 0.04;
  if (input.contactConfidence) score += Math.min(input.contactConfidence, 0.75) * 0.35;
  return Math.min(score, 0.98);
}

export class SearxngProvider implements SearchProvider {
  name = "searxng";

  enabled(): boolean {
    return env.searxngUrl.length > 0;
  }

  async search(query: string, context: SearchContext): Promise<SourceHit[]> {
    if (!this.enabled()) return [];

    const base = new URL(env.searxngUrl);
    if (base.protocol !== "https:" && base.protocol !== "http:") {
      throw new Error("SearXNG URL must be http or https");
    }
    const url = new URL("/search", base);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", "ru");
    url.searchParams.set("categories", "general");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.searxngTimeoutMs);

    try {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`SearXNG ${res.status} for ${url.origin}`);
      }

      const payload = (await res.json()) as SearxngResponse;
      const results = (payload.results ?? []).slice(0, env.searxngMaxResults);

      const hits: SourceHit[] = [];

      for (const [index, result] of results.entries()) {
        const plateExact = samePlateSignal(result, context.plateNormalized);
        const searchContext = isPublicVehicleSaleContext({
          url: result.url,
          title: result.title,
          snippet: result.content,
        });
        const shouldFetchPage = index < 2 && plateExact && publicPageFetchAllowed(result.url);
        const pageFetch = shouldFetchPage ? await fetchPublicPageText(result.url) : {};
        const combinedSnippet = [result.content, pageFetch.text].filter(Boolean).join("\n");
        const contacts = extractPublicContacts({
          url: result.url,
          title: result.title,
          snippet: combinedSnippet,
        });
        const phone = contacts.find((contact) => contact.kind === "phone");
        const email = contacts.find((contact) => contact.kind === "email");
        const vin = extractVin(`${result.title ?? ""} ${combinedSnippet}`);
        const confidence = confidenceFor({
          plateExact,
          vin,
          contactConfidence: contacts[0]?.confidence,
          vehicleContext: searchContext.ok,
          pageFetched: Boolean(pageFetch.text),
        });

        hits.push({
          source: this.name,
          url: result.url,
          title: result.title,
          snippet: result.content,
          query,
          plate: plateExact ? context.plateNormalized : undefined,
          vin,
          publicPhone: phone?.value,
          publicEmail: email?.value,
          imageUrls: [result.img_src, result.thumbnail].filter((value): value is string => Boolean(value)),
          publishedAt: parseDate(result.publishedDate),
          fetchedAt: new Date(),
          raw: result,
          normalized: {
            provider: this.name,
            engine: result.engine,
            engines: result.engines,
            category: result.category,
            host: hostOf(result.url),
            contacts,
            vin,
            vehicleContextSignals: searchContext.signals,
            pageFetch: shouldFetchPage
              ? {
                  attempted: true,
                  status: pageFetch.status,
                  error: pageFetch.error,
                  textSample: pageFetch.text?.slice(0, 1_000),
                }
              : { attempted: false },
          },
          derived: {
            sameVehicleSignals: [
              ...(plateExact ? [{ signal: "plate_exact_in_search_result", score: 90 }] : []),
              ...(vin ? [{ signal: "vin_candidate_in_public_result", score: 55 }] : []),
            ],
            contactSignals: contacts.flatMap((contact) => contact.signals),
            unresponsiveEngines: payload.unresponsive_engines ?? [],
          },
          confidence,
        });
      }

      return rankSourceHits(hits);
    } finally {
      clearTimeout(timeout);
    }
  }
}
