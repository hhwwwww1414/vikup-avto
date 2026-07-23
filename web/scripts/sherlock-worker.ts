import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "../src/lib/db";
import { env } from "../src/lib/env";
import { log } from "../src/lib/logger";
import {
  acquireNextSherlockLookupJob,
  processSherlockLookupJob,
} from "../src/lib/sherlock/jobs";

let stopping = false;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

async function main(): Promise<void> {
  log.info("sherlock.worker.started");
  while (!stopping) {
    const job = await acquireNextSherlockLookupJob();
    if (!job) {
      await delay(env.sherlockWorkerPollMs);
      continue;
    }
    await processSherlockLookupJob(job.id);
  }
  await prisma.$disconnect();
  log.info("sherlock.worker.stopped");
}

main().catch(async (error) => {
  log.error("sherlock.worker.crashed", { err: String(error) });
  await prisma.$disconnect();
  process.exit(1);
});
