import { env } from "@ums/config";
import { prisma } from "@ums/db";
import { createOutboxWorkerLoop } from "./outboxWorker.js";
import { createEmployeeSyncLoop } from "./employeeSyncWorker.js";
import { createTaskOverdueLoop } from "./taskOverdueWorker.js";

console.log(`Starting @ums/worker daemon in ${env.NODE_ENV} environment...`);

const loops = [createOutboxWorkerLoop(), createEmployeeSyncLoop(), createTaskOverdueLoop()];

for (const loop of loops) {
  loop.start();
}

let shuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Received ${signal}. Waiting for in-flight work to finish...`);
  await Promise.all(loops.map((loop) => loop.stop()));

  try {
    await prisma.$disconnect();
    console.log("Database disconnected. Worker shut down cleanly.");
    process.exit(0);
  } catch (err) {
    console.error("Error during database disconnect", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
