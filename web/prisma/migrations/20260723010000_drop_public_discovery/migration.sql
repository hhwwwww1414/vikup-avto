-- Drop removed public web discovery artifacts; Sherlock MTProto lookup remains.
DROP TABLE IF EXISTS "search_results" CASCADE;
DROP TABLE IF EXISTS "search_queries" CASCADE;
DROP TABLE IF EXISTS "search_runs" CASCADE;
DROP TABLE IF EXISTS "experiment_runs" CASCADE;
DROP TABLE IF EXISTS "intelligence_jobs" CASCADE;

DROP TYPE IF EXISTS "SearchRunStatus";
DROP TYPE IF EXISTS "ExperimentRunStatus";
DROP TYPE IF EXISTS "IntelligenceJobStatus";
