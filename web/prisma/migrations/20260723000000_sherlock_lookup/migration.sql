-- CreateEnum
CREATE TYPE "SherlockLookupStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING_REPORT', 'PARSING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "vehicles"
ADD COLUMN "sherlockLookupStatus" "SherlockLookupStatus",
ADD COLUMN "sherlock_best_phone" TEXT,
ADD COLUMN "sherlock_best_provider_confidence" DOUBLE PRECISION,
ADD COLUMN "sherlock_has_multiple_top_candidates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sherlock_updated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "sherlock_lookup_jobs" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "searched_plate" TEXT NOT NULL,
    "status" "SherlockLookupStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "next_run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error_message" TEXT,
    "raw_metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sherlock_lookup_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sherlock_reports" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "lookup_job_id" TEXT NOT NULL,
    "searched_plate" TEXT NOT NULL,
    "report_url" TEXT,
    "artifact_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "normalized_data" JSONB NOT NULL,
    "raw_metadata" JSONB NOT NULL DEFAULT '{}',
    "parser_version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sherlock_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sherlock_phone_candidates" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "lookup_job_id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "provider_confidence" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'SHERLOCK_REPORT',
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sherlock_phone_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sherlock_lookup_jobs_status_next_run_at_idx" ON "sherlock_lookup_jobs"("status", "next_run_at");

-- CreateIndex
CREATE INDEX "sherlock_lookup_jobs_vehicle_id_created_at_idx" ON "sherlock_lookup_jobs"("vehicle_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sherlock_reports_lookup_job_id_key" ON "sherlock_reports"("lookup_job_id");

-- CreateIndex
CREATE INDEX "sherlock_reports_vehicle_id_created_at_idx" ON "sherlock_reports"("vehicle_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sherlock_phone_candidates_report_id_phone_key" ON "sherlock_phone_candidates"("report_id", "phone");

-- CreateIndex
CREATE INDEX "sherlock_phone_candidates_vehicle_id_rank_idx" ON "sherlock_phone_candidates"("vehicle_id", "rank");

-- CreateIndex
CREATE INDEX "sherlock_phone_candidates_lookup_job_id_idx" ON "sherlock_phone_candidates"("lookup_job_id");

-- AddForeignKey
ALTER TABLE "sherlock_lookup_jobs" ADD CONSTRAINT "sherlock_lookup_jobs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sherlock_reports" ADD CONSTRAINT "sherlock_reports_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sherlock_reports" ADD CONSTRAINT "sherlock_reports_lookup_job_id_fkey" FOREIGN KEY ("lookup_job_id") REFERENCES "sherlock_lookup_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sherlock_phone_candidates" ADD CONSTRAINT "sherlock_phone_candidates_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sherlock_phone_candidates" ADD CONSTRAINT "sherlock_phone_candidates_lookup_job_id_fkey" FOREIGN KEY ("lookup_job_id") REFERENCES "sherlock_lookup_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sherlock_phone_candidates" ADD CONSTRAINT "sherlock_phone_candidates_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "sherlock_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
