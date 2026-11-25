-- CreateTable
CREATE TABLE "scheduled_runs" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "ok" BOOLEAN,
    "detail" JSONB,

    CONSTRAINT "scheduled_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_runs_job_started_at_idx" ON "scheduled_runs"("job", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "scheduled_runs_job_slot_key" ON "scheduled_runs"("job", "slot");
