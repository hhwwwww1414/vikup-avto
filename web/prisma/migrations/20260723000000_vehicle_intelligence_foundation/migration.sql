-- CreateEnum
CREATE TYPE "IntelligenceJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ExperimentRunStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "SearchRunStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "intelligence_jobs" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "status" "IntelligenceJobStatus" NOT NULL DEFAULT 'PENDING',
    "strategy" TEXT NOT NULL,
    "strategy_version" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "metrics" JSONB,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intelligence_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiment_runs" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "job_id" TEXT,
    "strategy" TEXT NOT NULL,
    "strategy_version" TEXT NOT NULL,
    "status" "ExperimentRunStatus" NOT NULL DEFAULT 'RUNNING',
    "parameters" JSONB,
    "metrics" JSONB,
    "results" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiment_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_runs" (
    "id" TEXT NOT NULL,
    "experiment_run_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "SearchRunStatus" NOT NULL DEFAULT 'RUNNING',
    "metrics" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_queries" (
    "id" TEXT NOT NULL,
    "search_run_id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "query_type" TEXT NOT NULL,
    "generated_by" TEXT NOT NULL,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "useful_result_count" INTEGER NOT NULL DEFAULT 0,
    "vehicle_match_count" INTEGER NOT NULL DEFAULT 0,
    "contact_found" BOOLEAN NOT NULL DEFAULT false,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_results" (
    "id" TEXT NOT NULL,
    "search_query_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "snippet" TEXT,
    "raw" JSONB,
    "normalized" JSONB,
    "derived" JSONB,
    "confidence" DOUBLE PRECISION,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intelligence_jobs_status_created_at_idx" ON "intelligence_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "intelligence_jobs_vehicle_id_idx" ON "intelligence_jobs"("vehicle_id");

-- CreateIndex
CREATE INDEX "experiment_runs_vehicle_id_started_at_idx" ON "experiment_runs"("vehicle_id", "started_at");

-- CreateIndex
CREATE INDEX "experiment_runs_strategy_strategy_version_idx" ON "experiment_runs"("strategy", "strategy_version");

-- CreateIndex
CREATE INDEX "experiment_runs_status_idx" ON "experiment_runs"("status");

-- CreateIndex
CREATE INDEX "search_runs_experiment_run_id_idx" ON "search_runs"("experiment_run_id");

-- CreateIndex
CREATE INDEX "search_runs_provider_idx" ON "search_runs"("provider");

-- CreateIndex
CREATE INDEX "search_queries_search_run_id_idx" ON "search_queries"("search_run_id");

-- CreateIndex
CREATE INDEX "search_queries_query_idx" ON "search_queries"("query");

-- CreateIndex
CREATE INDEX "search_results_search_query_id_idx" ON "search_results"("search_query_id");

-- CreateIndex
CREATE INDEX "search_results_source_idx" ON "search_results"("source");

-- CreateIndex
CREATE INDEX "search_results_url_idx" ON "search_results"("url");

-- AddForeignKey
ALTER TABLE "intelligence_jobs" ADD CONSTRAINT "intelligence_jobs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_runs" ADD CONSTRAINT "experiment_runs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiment_runs" ADD CONSTRAINT "experiment_runs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "intelligence_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_runs" ADD CONSTRAINT "search_runs_experiment_run_id_fkey" FOREIGN KEY ("experiment_run_id") REFERENCES "experiment_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_search_run_id_fkey" FOREIGN KEY ("search_run_id") REFERENCES "search_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_search_query_id_fkey" FOREIGN KEY ("search_query_id") REFERENCES "search_queries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
