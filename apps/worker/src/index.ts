import { env } from "@ums/config";
import { startOutboxWorkerLoop } from "./outboxWorker.js";

console.log(`Starting @ums/worker daemon in ${env.NODE_ENV} environment...`);

startOutboxWorkerLoop();
