import { prisma } from "@ums/db";
import { NotFoundError, ForbiddenError } from "../errors/AppError.js";
import { DispositionCreateInput, TaskProgressUpdateInput, TaskVerifyInput, UserProfile } from "@ums/contracts";
import { logAuditEvent } from "./auditService.js";

export async function createDisposition(memoId: string, input: DispositionCreateInput, issuer: UserProfile) {
  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findUnique({ where: { id: memoId } });
    if (!memo || memo.deletedAt) throw new NotFoundError("Memo not found");

    if (!["APPROVED", "OUTBOX", "PUBLISHED"].includes(memo.status)) {
      throw new ForbiddenError("Dispositions can only be issued on approved or published memos");
    }

    const disposition = await tx.memoDisposition.create({
      data: {
        memoId,
        issuerId: issuer.id,
        instruction: input.instruction,
        tasks: {
          create: input.tasks.map((t) => ({
            title: t.title,
            instruction: t.instruction,
            priority: t.priority,
            deadline: t.deadline ? new Date(t.deadline) : null,
            status: "NOT_STARTED",
            progress: 0,
            assignees: {
              create: t.assigneeUserIds.map((userId) => ({ userId })),
            },
            statusHistory: {
              create: {
                toStatus: "NOT_STARTED",
                actorId: issuer.id,
                comment: "Task created via disposition",
              },
            },
          })),
        },
      },
      include: {
        tasks: {
          include: { assignees: true },
        },
      },
    });

    await logAuditEvent({
      actorId: issuer.id,
      action: "DISPOSITION_CREATED",
      module: "disposition",
      resourceType: "MemoDisposition",
      resourceId: disposition.id,
      memoNumber: memo.memoNumber || undefined,
    });

    return disposition;
  });
}

export async function updateTaskProgress(taskId: string, input: TaskProgressUpdateInput, user: UserProfile) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: true },
  });
  if (!task) throw new NotFoundError("Task not found");

  const isAssignee = task.assignees.some((a) => a.userId === user.id);
  const isAdmin = user.roles.includes("SUPER_ADMIN");

  if (!isAssignee && !isAdmin) {
    throw new ForbiddenError("Only assigned users can update task progress");
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      progress: input.progress,
      status: input.status,
      startDate: task.startDate || new Date(),
      completedAt: input.status === "COMPLETED" ? new Date() : null,
    },
  });

  await prisma.taskStatusHistory.create({
    data: {
      taskId,
      fromStatus: task.status,
      toStatus: input.status,
      actorId: user.id,
      comment: input.comment || `Progress updated to ${input.progress}%`,
    },
  });

  await logAuditEvent({
    actorId: user.id,
    action: "TASK_PROGRESS_UPDATED",
    module: "disposition",
    resourceType: "Task",
    resourceId: taskId,
  });

  return updated;
}

export async function verifyTask(taskId: string, input: TaskVerifyInput, user: UserProfile) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { disposition: true },
  });
  if (!task) throw new NotFoundError("Task not found");

  const isIssuer = task.disposition.issuerId === user.id;
  const isAdmin = user.roles.includes("SUPER_ADMIN");

  if (!isIssuer && !isAdmin) {
    throw new ForbiddenError("Only the disposition issuer can verify task completion");
  }

  const newStatus = input.action === "APPROVE_COMPLETED" ? "COMPLETED" : "IN_PROGRESS";
  const newProgress = input.action === "APPROVE_COMPLETED" ? 100 : task.progress;

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: {
      status: newStatus,
      progress: newProgress,
      completedAt: input.action === "APPROVE_COMPLETED" ? new Date() : null,
    },
  });

  await prisma.taskStatusHistory.create({
    data: {
      taskId,
      fromStatus: task.status,
      toStatus: newStatus,
      actorId: user.id,
      comment: input.comment || `Verification action: ${input.action}`,
    },
  });

  await logAuditEvent({
    actorId: user.id,
    action: "TASK_VERIFIED",
    module: "disposition",
    resourceType: "Task",
    resourceId: taskId,
  });

  return updated;
}

export async function checkAndMarkOverdueTasks() {
  const now = new Date();
  const overdueTasks = await prisma.task.findMany({
    where: {
      deadline: { lt: now },
      status: { notIn: ["COMPLETED", "CANCELLED", "OVERDUE"] },
    },
    include: { assignees: true },
  });

  for (const task of overdueTasks) {
    await prisma.task.update({
      where: { id: task.id },
      data: { status: "OVERDUE" },
    });

    await prisma.taskStatusHistory.create({
      data: {
        taskId: task.id,
        fromStatus: task.status,
        toStatus: "OVERDUE",
        actorId: task.assignees?.[0]?.userId || "system",
        comment: "SLA Deadline exceeded. Task marked OVERDUE automatically.",
      },
    });
  }

  return overdueTasks.length;
}
