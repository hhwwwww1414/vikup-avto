import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "../src/lib/db";
import { env } from "../src/lib/env";
import { log } from "../src/lib/logger";
import {
  acquireNextSherlockLookupJob,
  processSherlockLookupJob,
} from "../src/lib/sherlock/jobs";
import { TeleprotoSherlockProvider } from "../src/lib/sherlock/provider";

let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

async function main(): Promise<void> {
  const provider = new TeleprotoSherlockProvider();
  const active = new Set<Promise<void>>();
  log.info("sherlock.worker.started", { concurrency: env.sherlockWorkerConcurrency });

  const startJob = (jobId: string): void => {
    const task = processSherlockLookupJob(jobId, provider)
      .catch((error) => {
        log.error("sherlock.worker.jobUnhandled", { jobId, err: String(error) });
      })
      .finally(() => {
        active.delete(task);
      });
    active.add(task);
  };

  while (!stopping) {
    while (active.size < env.sherlockWorkerConcurrency) {
      const job = await acquireNextSherlockLookupJob();
      if (!job) break;
      startJob(job.id);
    }

    if (active.size === 0) {
      await delay(env.sherlockWorkerPollMs);
      continue;
    }

    await Promise.race([
      ...active,
      delay(env.sherlockWorkerPollMs),
    ]);
  }

  await Promise.allSettled(active);
  await prisma.$disconnect();
  log.info("sherlock.worker.stopped");
}

main().catch(async (error) => {
  log.error("sherlock.worker.crashed", { err: String(error) });
  await prisma.$disconnect();
  process.exit(1);
});
