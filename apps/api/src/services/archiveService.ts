import { prisma } from "@ums/db";
import { UserProfile } from "@ums/contracts";
import { ForbiddenError, NotFoundError } from "../errors/AppError.js";
import { logAuditEvent } from "./auditService.js";

function canManageArchive(memo: { authorId: string }, user: UserProfile): boolean {
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("MEMO_ADMIN");
  return isAdmin || memo.authorId === user.id;
}

export async function deleteDraft(memoId: string, user: UserProfile) {
  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findUnique({ where: { id: memoId } });
    if (!memo || memo.deletedAt) throw new NotFoundError("Memo not found");

    if (!canManageArchive(memo, user)) {
      throw new ForbiddenError("Only the author or an administrator can delete this draft");
    }

    if (!["DRAFT", "REVISION"].includes(memo.status)) {
      throw new ForbiddenError("Only DRAFT or REVISION memos can be deleted. Use cancel or archive instead.");
    }

    const updated = await tx.memo.update({
      where: { id: memoId },
      data: { deletedAt: new Date() },
    });

    await logAuditEvent({
      actorId: user.id,
      action: "DRAFT_DELETED",
      module: "memo",
      resourceType: "Memo",
      resourceId: memoId,
    });

    return updated;
  });
}

export async function archiveMemo(memoId: string, user: UserProfile) {
  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findUnique({ where: { id: memoId } });
    if (!memo || memo.deletedAt) throw new NotFoundError("Memo not found");

    if (!user.permissions.includes("memo.archive")) {
      throw new ForbiddenError("Permission denied: requires [memo.archive]");
    }

    if (!["PUBLISHED", "OUTBOX"].includes(memo.status)) {
      throw new ForbiddenError(`Cannot archive memo with status ${memo.status}`);
    }

    const updated = await tx.memo.update({
      where: { id: memoId },
      data: { status: "ARCHIVED" },
    });

    await tx.memoStatusHistory.create({
      data: { memoId, fromStatus: memo.status, toStatus: "ARCHIVED", actorId: user.id, reason: "Archived" },
    });

    await logAuditEvent({
      actorId: user.id,
      action: "MEMO_ARCHIVED",
      module: "memo",
      resourceType: "Memo",
      resourceId: memoId,
      memoNumber: memo.memoNumber || undefined,
    });

    return updated;
  });
}

export async function restoreMemo(memoId: string, user: UserProfile) {
  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findUnique({ where: { id: memoId } });
    if (!memo || memo.deletedAt) throw new NotFoundError("Memo not found");

    if (!user.permissions.includes("memo.archive")) {
      throw new ForbiddenError("Permission denied: requires [memo.archive]");
    }

    if (memo.status !== "ARCHIVED") {
      throw new ForbiddenError("Only ARCHIVED memos can be restored");
    }

    const lastArchiveEvent = await tx.memoStatusHistory.findFirst({
      where: { memoId, toStatus: "ARCHIVED" },
      orderBy: { createdAt: "desc" },
    });
    const restoreToStatus = lastArchiveEvent?.fromStatus && ["PUBLISHED", "OUTBOX"].includes(lastArchiveEvent.fromStatus)
      ? lastArchiveEvent.fromStatus
      : "PUBLISHED";

    const updated = await tx.memo.update({
      where: { id: memoId },
      data: { status: restoreToStatus },
    });

    await tx.memoStatusHistory.create({
      data: { memoId, fromStatus: "ARCHIVED", toStatus: restoreToStatus, actorId: user.id, reason: "Restored from archive" },
    });

    await logAuditEvent({
      actorId: user.id,
      action: "MEMO_RESTORED",
      module: "memo",
      resourceType: "Memo",
      resourceId: memoId,
      memoNumber: memo.memoNumber || undefined,
    });

    return updated;
  });
}
