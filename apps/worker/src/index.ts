import { env } from "@ums/config";
import { startOutboxWorkerLoop } from "./outboxWorker.js";
import { startEmployeeSyncLoop } from "./employeeSyncWorker.js";
import { startTaskOverdueLoop } from "./taskOverdueWorker.js";

console.log(`Starting @ums/worker daemon in ${env.NODE_ENV} environment...`);

startOutboxWorkerLoop();
startEmployeeSyncLoop();
startTaskOverdueLoop();
