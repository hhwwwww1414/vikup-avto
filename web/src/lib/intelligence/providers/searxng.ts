import { env } from "@/lib/env";
import { normalizePlateInput } from "@/lib/plate";
import { extractPublicContacts } from "../contact-extraction";
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

      return results.map((result): SourceHit => {
        const contacts = extractPublicContacts({
          url: result.url,
          title: result.title,
          snippet: result.content,
        });
        const phone = contacts.find((contact) => contact.kind === "phone");
        const email = contacts.find((contact) => contact.kind === "email");
        const plateExact = samePlateSignal(result, context.plateNormalized);

        return {
          source: this.name,
          url: result.url,
          title: result.title,
          snippet: result.content,
          query,
          plate: plateExact ? context.plateNormalized : undefined,
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
            contacts,
          },
          derived: {
            sameVehicleSignals: plateExact ? [{ signal: "plate_exact_in_search_result", score: 90 }] : [],
            contactSignals: contacts.flatMap((contact) => contact.signals),
            unresponsiveEngines: payload.unresponsive_engines ?? [],
          },
          confidence: plateExact ? 0.9 : contacts.length > 0 ? contacts[0].confidence : 0.2,
        };
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
