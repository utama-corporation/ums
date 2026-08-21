/**
 * One-off trigger for the department/division/sub-division sync (see
 * src/departmentSyncWorker.ts) without waiting for its normal interval or restarting the
 * worker daemon. Useful right after a fresh deploy — the polling loop's first automatic run
 * doesn't happen until a full interval has elapsed, but the legacy data migration needs
 * Company/Department rows populated immediately.
 *
 * Usage (run from apps/worker):
 *   npx tsx scripts/runDepartmentSyncOnce.ts
 */
import { runDepartmentSyncCycle } from "../src/departmentSyncWorker.js";
import { prisma } from "@ums/db";

runDepartmentSyncCycle()
  .then((result) => {
    console.log("Department sync complete:", result);
  })
  .catch((err) => {
    console.error("Department sync failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
