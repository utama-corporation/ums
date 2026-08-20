import { prisma } from "@ums/db";
import { NotFoundError, ForbiddenError, ConflictError } from "../errors/AppError.js";
import { MemoCreateDraftInput, MemoUpdateDraftInput, MemoAutosaveInput, MemoPriority, MemoClassification, MemoPartyInput } from "@ums/contracts";
import { sanitizeMemoHtml } from "./sanitizerService.js";
import { logAuditEvent } from "./auditService.js";
import { UserProfile } from "@ums/contracts";

export function isMemoAuthorOrAdmin(memo: { authorId: string }, user: UserProfile): boolean {
  return memo.authorId === user.id || user.roles.includes("SUPER_ADMIN") || user.roles.includes("MEMO_ADMIN");
}

/**
 * Same confidentiality/scope rule getMemoDetail() has always enforced for CONFIDENTIAL and
 * HIGHLY_CONFIDENTIAL memos — factored out so attachment downloads and canonical-PDF downloads
 * (which expose the same content, arguably more directly) apply the identical check instead of
 * skipping it entirely.
 */
export function assertMemoViewScope(
  memo: { authorId: string; classification: string; recipients: { partyId: string | null }[] },
  user: UserProfile
): void {
  if (memo.classification !== "CONFIDENTIAL" && memo.classification !== "HIGHLY_CONFIDENTIAL") return;

  const isAuthor = memo.authorId === user.id;
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("MEMO_ADMIN");
  const isRecipientUser = memo.recipients.some((r) => r.partyId === user.id);
  const isRecipientDept = memo.recipients.some((r) => r.partyId === user.departmentId);

  if (!isAuthor && !isAdmin && !isRecipientUser && !isRecipientDept) {
    throw new ForbiddenError("Access denied: Confidential memo");
  }
}

export function calculateMemoCapabilities(memo: { authorId: string; status: string }, user: UserProfile) {
  const isAuthor = memo.authorId === user.id;
  const isDraft = ["DRAFT", "REVISION"].includes(memo.status);
  const isApproved = memo.status === "APPROVED";
  const isPublished = memo.status === "PUBLISHED";
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("MEMO_ADMIN");

  return {
    canEdit: (isAuthor || isAdmin) && isDraft,
    canDelete: (isAuthor || isAdmin) && isDraft,
    canSubmit: (isAuthor || isAdmin) && isDraft && user.permissions.includes("memo.submit"),
    canApprove: memo.status === "WAITING_APPROVAL" && user.permissions.includes("memo.approve"),
    canReject: memo.status === "WAITING_APPROVAL" && user.permissions.includes("memo.reject"),
    canRevision: memo.status === "WAITING_APPROVAL" && user.permissions.includes("memo.approve"),
    canDistribute: isApproved && user.permissions.includes("memo.publish"),
    canPublish: (isApproved || memo.status === "OUTBOX") && user.permissions.includes("memo.publish"),
    canArchive: (isPublished || memo.status === "OUTBOX") && user.permissions.includes("memo.archive"),
  };
}

export async function createDraft(input: MemoCreateDraftInput, authorId: string) {
  const sanitizedHtml = sanitizeMemoHtml(input.bodyHtml);

  const memo = await prisma.memo.create({
    data: {
      title: input.title,
      categoryId: input.categoryId,
      memoTypeId: input.memoTypeId,
      priority: input.priority,
      classification: input.classification,
      deadline: input.deadline ? new Date(input.deadline) : null,
      status: "DRAFT",
      authorId,
      currentVersion: 1,
      lockVersion: 1,
      contentVersions: {
        create: {
          version: 1,
          bodyHtml: sanitizedHtml,
          createdById: authorId,
        },
      },
      senders: {
        create: input.senders.map((s) => ({
          partyType: s.partyType,
          partyId: s.partyId || null,
          displayName: s.displayName,
        })),
      },
      recipients: {
        create: input.recipients.map((r) => ({
          partyType: r.partyType,
          partyId: r.partyId || null,
          displayName: r.displayName,
          email: r.email || null,
        })),
      },
      ccs: {
        create: input.ccs.map((c) => ({
          partyType: c.partyType,
          partyId: c.partyId || null,
          displayName: c.displayName,
        })),
      },
      statusHistory: {
        create: {
          toStatus: "DRAFT",
          actorId: authorId,
          reason: "Draft created",
        },
      },
    },
    include: {
      contentVersions: true,
      senders: true,
      recipients: true,
      ccs: true,
    },
  });

  await logAuditEvent({
    actorId: authorId,
    action: "DRAFT_CREATED",
    module: "memo",
    resourceType: "Memo",
    resourceId: memo.id,
  });

  return memo;
}

export async function updateDraft(memoId: string, input: MemoUpdateDraftInput, actor: UserProfile) {
  const memo = await prisma.memo.findUnique({
    where: { id: memoId },
    include: { contentVersions: true },
  });
  if (!memo) throw new NotFoundError("Memo draft not found");

  if (!isMemoAuthorOrAdmin(memo, actor)) {
    throw new ForbiddenError("Only the memo's author can edit this draft");
  }

  if (!["DRAFT", "REVISION"].includes(memo.status)) {
    throw new ForbiddenError("Only DRAFT or REVISION memos can be updated");
  }

  // Optimistic Concurrency Check
  if (input.lockVersion !== undefined && input.lockVersion !== memo.lockVersion) {
    throw new ConflictError("Draft has been modified by another process. Please refresh.");
  }

  const updatedBodyHtml = input.bodyHtml !== undefined ? sanitizeMemoHtml(input.bodyHtml) : undefined;
  const nextLockVersion = memo.lockVersion + 1;

  if (input.senders) {
    await prisma.memoSender.deleteMany({ where: { memoId } });
    await prisma.memoSender.createMany({
      data: input.senders.map((s) => ({
        memoId,
        partyType: s.partyType,
        partyId: s.partyId || null,
        displayName: s.displayName,
      })),
    });
  }

  if (input.recipients) {
    await prisma.memoRecipient.deleteMany({ where: { memoId } });
    await prisma.memoRecipient.createMany({
      data: input.recipients.map((r) => ({
        memoId,
        partyType: r.partyType,
        partyId: r.partyId || null,
        displayName: r.displayName,
        email: r.email || null,
      })),
    });
  }

  if (input.ccs) {
    await prisma.memoCc.deleteMany({ where: { memoId } });
    await prisma.memoCc.createMany({
      data: input.ccs.map((c) => ({
        memoId,
        partyType: c.partyType,
        partyId: c.partyId || null,
        displayName: c.displayName,
      })),
    });
  }

  if (updatedBodyHtml !== undefined) {
    const latestVersion = memo.currentVersion;
    await prisma.memoContentVersion.upsert({
      where: { memoId_version: { memoId, version: latestVersion } },
      update: { bodyHtml: updatedBodyHtml },
      create: { memoId, version: latestVersion, bodyHtml: updatedBodyHtml, createdById: actor.id },
    });
  }

  const updated = await prisma.memo.update({
    where: { id: memoId },
    data: {
      title: input.title,
      categoryId: input.categoryId,
      memoTypeId: input.memoTypeId,
      priority: input.priority,
      classification: input.classification,
      deadline: input.deadline !== undefined ? (input.deadline ? new Date(input.deadline) : null) : undefined,
      lockVersion: nextLockVersion,
    },
    include: {
      contentVersions: true,
      senders: true,
      recipients: true,
      ccs: true,
    },
  });

  return updated;
}

export async function autosaveDraft(memoId: string, input: MemoAutosaveInput, actor: UserProfile) {
  const memo = await prisma.memo.findUnique({ where: { id: memoId } });
  if (!memo) throw new NotFoundError("Memo draft not found");

  if (!isMemoAuthorOrAdmin(memo, actor)) {
    throw new ForbiddenError("Only the memo's author can autosave this draft");
  }

  if (!["DRAFT", "REVISION"].includes(memo.status)) {
    throw new ForbiddenError("Autosave is only permitted on DRAFT or REVISION memos");
  }

  if (input.lockVersion !== memo.lockVersion) {
    throw new ConflictError("Draft lock version conflict during autosave.");
  }

  const sanitized = sanitizeMemoHtml(input.bodyHtml);
  const nextLockVersion = memo.lockVersion + 1;

  await prisma.memoContentVersion.upsert({
    where: { memoId_version: { memoId, version: memo.currentVersion } },
    update: { bodyHtml: sanitized },
    create: { memoId, version: memo.currentVersion, bodyHtml: sanitized, createdById: actor.id },
  });

  const updated = await prisma.memo.update({
    where: { id: memoId },
    data: { lockVersion: nextLockVersion },
  });

  return { lockVersion: updated.lockVersion, updatedAt: updated.updatedAt };
}

export async function getMemoDetail(memoId: string, user: UserProfile) {
  const memo = await prisma.memo.findUnique({
    where: { id: memoId },
    include: {
      category: true,
      memoType: true,
      contentVersions: { orderBy: { version: "desc" } },
      senders: true,
      recipients: true,
      ccs: true,
      attachments: { include: { attachmentObject: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!memo || memo.deletedAt) {
    throw new NotFoundError("Memo not found");
  }

  assertMemoViewScope(memo, user);

  const capabilities = calculateMemoCapabilities(memo, user);

  return {
    ...memo,
    capabilities,
  };
}

export async function copyDraft(memoId: string, actor: UserProfile) {
  const source = await prisma.memo.findUnique({
    where: { id: memoId },
    include: {
      contentVersions: { orderBy: { version: "desc" }, take: 1 },
      senders: true,
      recipients: true,
      ccs: true,
    },
  });
  if (!source) throw new NotFoundError("Source memo not found");

  // Copying exposes the full body/recipients of the source memo into a new
  // draft the caller owns — must be at least as strict as viewing it.
  assertMemoViewScope(source, actor);

  const latestContent = source.contentVersions[0]?.bodyHtml || "";

  return createDraft(
    {
      title: `Copy of ${source.title}`,
      categoryId: source.categoryId,
      memoTypeId: source.memoTypeId,
      priority: source.priority as MemoPriority,
      classification: source.classification as MemoClassification,
      deadline: source.deadline ? source.deadline.toISOString() : null,
      bodyHtml: latestContent,
      senders: source.senders.map((s): MemoPartyInput => ({ partyType: s.partyType as "USER" | "DEPARTMENT" | "EXTERNAL", partyId: s.partyId, displayName: s.displayName })),
      recipients: source.recipients.map((r): MemoPartyInput => ({ partyType: r.partyType as "USER" | "DEPARTMENT" | "EXTERNAL", partyId: r.partyId, displayName: r.displayName, email: r.email })),
      ccs: source.ccs.map((c): MemoPartyInput => ({ partyType: c.partyType as "USER" | "DEPARTMENT" | "EXTERNAL", partyId: c.partyId, displayName: c.displayName })),
    },
    actor.id
  );
}
