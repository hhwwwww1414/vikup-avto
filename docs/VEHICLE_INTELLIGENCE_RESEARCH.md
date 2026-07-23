# Vehicle Intelligence Research

## Current Architecture

Telegram ingestion is handled by `web/src/app/api/telegram/webhook/route.ts`.
The route validates the Telegram webhook secret, deduplicates updates in memory,
acknowledges Telegram immediately, and runs `handleTelegramMessage` in the
background.

`handleTelegramMessage` in `web/src/lib/ingest.ts` authorizes the sender by
`users.telegram_id`, accepts photo messages or image documents, downloads the
Telegram file, calls the OCR service through `web/src/lib/ocr.ts`, stores the
normalized image and thumbnail in S3 through `web/src/lib/s3.ts`, and creates a
`vehicles` row.

The OCR service lives in `ocr/` and is reachable only on the Docker Compose
internal network as `http://ocr:8000`. It is not published to the internet.

Garage is rendered from `web/src/app/(app)/garage/page.tsx` and currently reads
from `vehicles`, with image delivery proxied through `/api/image`.

The production runtime in `docker-compose.yml` has `ocr`, `web`, and `caddy`.
Phase 1 adds an `intelligence-worker` process using the same web image and the
same PostgreSQL database.

## Phase 1 Decisions

The first implementation intentionally avoids external lookups. It establishes
the research trail and benchmark infrastructure with an `internal_history`
provider only. This creates a safe baseline and proves the async job, experiment,
query, and evidence storage model before adding public web providers.

New data follows this progression:

```text
Vehicle
  -> IntelligenceJob
  -> ExperimentRun
  -> SearchRun
  -> SearchQuery
  -> SearchResult
```

Raw, normalized, and derived evidence is stored separately on `search_results`.
Experiment-level metrics are stored on `experiment_runs.metrics`; previous runs
are never overwritten.

Contacts are modeled as search result evidence only when explicitly published by
a provider in a public vehicle-sale or seller-profile context. The system does
not infer `ownerPhone` and does not use leaks, closed databases, grey Telegram
bots, private APIs, auth bypass, or CAPTCHA bypass.

## Implemented Baseline

`plate_query_generator_v1` emits exact, display, spaced, Latin-lookalike, quoted,
and keyword query variants.

`internal_history_baseline` uses `InternalHistoryProvider` to search the
project's own Garage history by normalized plate. It records query counts,
result counts, vehicle matches, contact discovery, latency, and provider errors.

The worker can be run locally with:

```bash
npm run intelligence:run-once
```

or continuously with:

```bash
npm run intelligence:worker
```

The admin dashboard is available at:

```text
/intelligence/experiments
```

## Phase 2 Public Web Discovery

`public_vehicle_discovery` v2 keeps `internal_history` and adds `searxng` when
`SEARXNG_URL` is configured. The provider calls the SearXNG JSON API:

```text
/search?q=<query>&format=json&language=ru&categories=general
```

If JSON output is disabled on the SearXNG instance, the provider records the
HTTP error as negative evidence in the `SearchRun`.

Contact extraction is deliberately constrained. A phone or email becomes a
candidate only when it is explicitly present in a public search result and the
result has vehicle-sale context, such as a known listing/dealer domain or
listing words like sale, dealer, listing, VIN, mileage, or trade-in. These
records are stored as `PublicContact`-style candidates in experiment results;
they are not treated as owner phones.

## Next Hypotheses

1. Run SearXNG against at least 20 real vehicles and compare query variants.
2. Store fetched page evidence separately before extracting VIN, listing status,
   seller identity, or public contact candidates.
3. Add failure codes for no trace, parser failure, false match, stale contact,
   and search recall misses.
4. Add vehicle-level debug replay only after baseline runs exist in the database.
