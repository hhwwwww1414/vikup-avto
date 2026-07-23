export interface SourceHit {
  source: string;
  url?: string;
  title?: string;
  snippet?: string;
  query?: string;
  plate?: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  city?: string;
  region?: string;
  sellerName?: string;
  sellerUsername?: string;
  publicPhone?: string;
  publicEmail?: string;
  imageUrls?: string[];
  publishedAt?: Date;
  fetchedAt: Date;
  raw?: unknown;
  normalized?: unknown;
  derived?: unknown;
  confidence?: number;
}

export interface SearchContext {
  vehicleId: string;
  plateNormalized: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, context: SearchContext): Promise<SourceHit[]>;
}

export interface StrategyRunSummary {
  queryCount: number;
  resultCount: number;
  usefulResultCount: number;
  vehicleMatchCount: number;
  contactFound: boolean;
  contactCandidateCount: number;
  latencyMs: number;
  errors: string[];
}
