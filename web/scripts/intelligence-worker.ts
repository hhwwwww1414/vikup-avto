import { prisma } from "../src/lib/db";
import { log } from "../src/lib/logger";
import { runNextIntelligenceJob } from "../src/lib/intelligence/run";

const once = process.argv.includes("--once");
const idleMs = Number(process.env.INTELLIGENCE_WORKER_IDLE_MS ?? "5000");

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  log.info("intelligence.worker.start", { once, idleMs });

  do {
    const ran = await runNextIntelligenceJob();
    if (once) break;
    if (!ran) await sleep(idleMs);
  } while (true);
}

main()
  .catch((err) => {
    log.error("intelligence.worker.error", { err: String(err) });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
