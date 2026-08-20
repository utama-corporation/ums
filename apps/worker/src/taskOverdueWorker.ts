import { prisma } from "@ums/db";
import { createPollingLoop, PollingLoop } from "./pollingLoop.js";

export async function runTaskOverdueCycle(): Promise<number> {
  const now = new Date();
  const overdueTasks = await prisma.task.findMany({
    where: {
      deadline: { lt: now },
      status: { notIn: ["COMPLETED", "CANCELLED", "OVERDUE"] },
    },
    include: { assignees: true, disposition: true },
  });

  for (const task of overdueTasks) {
    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: task.id },
        data: { status: "OVERDUE" },
      });

      await tx.taskStatusHistory.create({
        data: {
          taskId: task.id,
          fromStatus: task.status,
          toStatus: "OVERDUE",
          actorId: null,
          comment: "SLA deadline exceeded. Task marked OVERDUE automatically.",
        },
      });

      await tx.domainOutboxEvent.create({
        data: {
          eventType: "TASK_OVERDUE",
          aggregateType: "Task",
          aggregateId: task.id,
          payloadJson: JSON.stringify({
            taskId: task.id,
            title: task.title,
            issuerId: task.disposition.issuerId,
            assigneeUserIds: task.assignees.map((a) => a.userId),
          }),
        },
      });
    });
  }

  if (overdueTasks.length > 0) {
    console.log(`[TASK_OVERDUE] Marked ${overdueTasks.length} task(s) overdue`);
  }

  return overdueTasks.length;
}

export function createTaskOverdueLoop(intervalMs = 15 * 60 * 1000): PollingLoop {
  return createPollingLoop("TASK_OVERDUE", intervalMs, runTaskOverdueCycle);
}
