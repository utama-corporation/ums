import { prisma } from "@ums/db";
import { NotFoundError, ForbiddenError } from "../errors/AppError.js";
import { logAuditEvent } from "./auditService.js";
import crypto from "crypto";
import { UserProfile } from "@ums/contracts";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function distributeMemo(memoId: string, user: UserProfile) {
  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findUnique({
      where: { id: memoId },
      include: {
        recipients: true,
        distributions: true,
      },
    });

    if (!memo || memo.deletedAt) throw new NotFoundError("Memo not found");

    if (!["APPROVED", "PUBLISHED", "OUTBOX"].includes(memo.status)) {
      throw new ForbiddenError("Only APPROVED or PUBLISHED memos can be distributed");
    }

    const distribution = await tx.memoDistribution.create({
      data: {
        memoId,
        distributedById: user.id,
      },
    });

    const externalTokens: { recipientName: string; email?: string | null; token: string; expiresAt: Date }[] = [];

    for (const recipient of memo.recipients) {
      if (recipient.partyType === "USER" && recipient.partyId) {
        await tx.distributionRecipient.create({
          data: {
            memoDistributionId: distribution.id,
            recipientUserId: recipient.partyId,
            isExternal: false,
          },
        });
      } else if (recipient.partyType === "DEPARTMENT" && recipient.partyId) {
        // Snapshot current active department user members at distribution time
        const deptUsers = await tx.user.findMany({
          where: { departmentId: recipient.partyId, isActive: true },
          select: { id: true },
        });

        for (const deptUser of deptUsers) {
          await tx.distributionRecipient.create({
            data: {
              memoDistributionId: distribution.id,
              recipientUserId: deptUser.id,
              recipientDeptId: recipient.partyId,
              isExternal: false,
            },
          });
        }
      } else if (recipient.partyType === "EXTERNAL") {
        // Block external delivery for CONFIDENTIAL or HIGHLY_CONFIDENTIAL memos per policy
        if (memo.classification === "CONFIDENTIAL" || memo.classification === "HIGHLY_CONFIDENTIAL") {
          throw new ForbiddenError(`External distribution is prohibited for ${memo.classification} memos.`);
        }

        const distRecipient = await tx.distributionRecipient.create({
          data: {
            memoDistributionId: distribution.id,
            isExternal: true,
          },
        });

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await tx.externalRecipientAccess.create({
          data: {
            distributionRecipientId: distRecipient.id,
            tokenHash,
            expiresAt,
          },
        });

        externalTokens.push({
          recipientName: recipient.displayName,
          email: recipient.email,
          token: rawToken,
          expiresAt,
        });
      }
    }

    if (memo.status === "APPROVED") {
      await tx.memo.update({
        where: { id: memoId },
        data: { status: "OUTBOX" },
      });

      await tx.memoStatusHistory.create({
        data: { memoId, fromStatus: "APPROVED", toStatus: "OUTBOX", actorId: user.id, reason: "Distributed to recipients" },
      });
    }

    await tx.domainOutboxEvent.create({
      data: {
        eventType: "MEMO_DISTRIBUTED",
        aggregateType: "Memo",
        aggregateId: memoId,
        payloadJson: JSON.stringify({ memoId, distributionId: distribution.id, externalTokensCount: externalTokens.length }),
      },
    });

    await logAuditEvent({
      actorId: user.id,
      action: "MEMO_DISTRIBUTED",
      module: "distribution",
      resourceType: "MemoDistribution",
      resourceId: distribution.id,
      memoNumber: memo.memoNumber || undefined,
    });

    return { distributionId: distribution.id, externalTokens };
  });
}

export async function recordReadReceipt(memoId: string, userId: string) {
  const distRecipient = await prisma.distributionRecipient.findFirst({
    where: {
      recipientUserId: userId,
      distribution: { memoId },
    },
  });

  if (!distRecipient) return null;

  return prisma.readReceipt.upsert({
    where: {
      distributionRecipientId_userId: {
        distributionRecipientId: distRecipient.id,
        userId,
      },
    },
    update: {
      lastViewedAt: new Date(),
    },
    create: {
      distributionRecipientId: distRecipient.id,
      userId,
      firstReadAt: new Date(),
    },
  });
}

export async function getExternalMemoByToken(rawToken: string, ipAddress?: string, userAgent?: string) {
  const tokenHash = hashToken(rawToken);

  const access = await prisma.externalRecipientAccess.findUnique({
    where: { tokenHash },
    include: {
      distributionRecipient: {
        include: {
          distribution: {
            include: {
              memo: {
                include: {
                  category: true,
                  memoType: true,
                  senders: true,
                  contentVersions: { orderBy: { version: "desc" }, take: 1 },
                  attachments: { include: { attachmentObject: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!access || access.revokedAt || access.expiresAt < new Date()) {
    throw new NotFoundError("External access token invalid, expired, or revoked");
  }

  const memo = access.distributionRecipient.distribution.memo;

  // Block confidential memo access
  if (memo.classification === "CONFIDENTIAL" || memo.classification === "HIGHLY_CONFIDENTIAL") {
    throw new ForbiddenError("Confidential memos cannot be accessed via external token link");
  }

  // Increment access count
  await prisma.externalRecipientAccess.update({
    where: { id: access.id },
    data: { accessCount: { increment: 1 } },
  });

  await logAuditEvent({
    action: "EXTERNAL_MEMO_ACCESSED",
    module: "external",
    resourceType: "Memo",
    resourceId: memo.id,
    memoNumber: memo.memoNumber || undefined,
    ipAddress,
    userAgent,
  });

  return {
    memoNumber: memo.memoNumber,
    title: memo.title,
    memoDate: memo.memoDate,
    categoryName: memo.category.name,
    typeName: memo.memoType.name,
    priority: memo.priority,
    classification: memo.classification,
    bodyHtml: memo.contentVersions[0]?.bodyHtml || "",
    senders: memo.senders.map((s) => s.displayName),
    attachments: memo.attachments.map((a) => ({ id: a.attachmentObjectId, fileName: a.attachmentObject.fileName, size: a.attachmentObject.fileSize })),
  };
}
