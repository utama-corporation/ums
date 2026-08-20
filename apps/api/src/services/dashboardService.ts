import { prisma, Prisma } from "@ums/db";
import { UserProfile } from "@ums/contracts";

const ADMIN_ROLES = ["SUPER_ADMIN", "MEMO_ADMIN", "AUDITOR"];

function isPrivilegedScope(user: UserProfile): boolean {
  return user.roles.some((r) => ADMIN_ROLES.includes(r));
}

function memoScopeWhere(user: UserProfile, isAdmin: boolean): Prisma.MemoWhereInput {
  if (isAdmin) return { deletedAt: null };

  return {
    deletedAt: null,
    OR: [
      { authorId: user.id },
      { recipients: { some: { partyId: user.id } } },
      ...(user.departmentId ? [{ recipients: { some: { partyId: user.departmentId } } }] : []),
    ],
  };
}

const ALL_MEMO_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "WAITING_APPROVAL",
  "REVISION",
  "REJECTED",
  "CANCELLED",
  "APPROVED",
  "OUTBOX",
  "PUBLISHED",
  "ARCHIVED",
];

export async function getDashboardStats(user: UserProfile) {
  const isAdmin = isPrivilegedScope(user);
  const scopeWhere = memoScopeWhere(user, isAdmin);

  const [statusGroups, unfinishedTasks, unreadCount, recentActivity, categoryGroups, waitingApprovalMemos] = await Promise.all([
    prisma.memo.groupBy({ by: ["status"], where: scopeWhere, _count: { _all: true } }),
    prisma.task.count({
      where: {
        assignees: { some: { userId: user.id } },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
    }),
    prisma.distributionRecipient.count({
      where: {
        recipientUserId: user.id,
        readReceipts: { none: { userId: user.id } },
      },
    }),
    prisma.memoStatusHistory.findMany({
      where: { memo: scopeWhere },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { memo: { select: { id: true, title: true, memoNumber: true } } },
    }),
    prisma.memo.groupBy({ by: ["categoryId"], where: scopeWhere, _count: { _all: true } }),
    prisma.memo.findMany({
      where: { ...scopeWhere, status: "WAITING_APPROVAL" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, title: true, memoNumber: true, priority: true, authorId: true },
    }),
  ]);

  const authors = await prisma.user.findMany({
    where: { id: { in: waitingApprovalMemos.map((m) => m.authorId) } },
    select: { id: true, fullName: true },
  });
  const authorNameById = new Map(authors.map((a) => [a.id, a.fullName]));
  const waitingApprovalPreview = waitingApprovalMemos.map((m) => ({
    id: m.id,
    title: m.title,
    memoNumber: m.memoNumber,
    priority: m.priority,
    authorName: authorNameById.get(m.authorId) ?? "-",
  }));

  const totals: Record<string, number> = Object.fromEntries(ALL_MEMO_STATUSES.map((s) => [s, 0]));
  for (const g of statusGroups) {
    totals[g.status] = g._count._all;
  }

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryGroups.map((g) => g.categoryId) } },
    select: { id: true, name: true },
  });
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const categoryBreakdown = categoryGroups.map((g) => ({
    categoryId: g.categoryId,
    categoryName: categoryNameById.get(g.categoryId) ?? "Unknown",
    count: g._count._all,
  }));

  const departmentBreakdown = isAdmin
    ? await prisma.$queryRaw<{ departmentId: string | null; departmentName: string | null; count: number }[]>`
        SELECT u."departmentId" as "departmentId", d.name as "departmentName", COUNT(m.id)::int as count
        FROM "Memo" m
        JOIN "User" u ON u.id = m."authorId"
        LEFT JOIN "Department" d ON d.id = u."departmentId"
        WHERE m."deletedAt" IS NULL
        GROUP BY u."departmentId", d.name
        ORDER BY count DESC
      `
    : [];

  const trend = isAdmin
    ? await prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT to_char(date_trunc('month', "memoDate"), 'YYYY-MM') as month, COUNT(*)::int as count
        FROM "Memo"
        WHERE "deletedAt" IS NULL AND "memoDate" >= (CURRENT_DATE - INTERVAL '6 months')
        GROUP BY month
        ORDER BY month ASC
      `
    : await prisma.$queryRaw<{ month: string; count: number }[]>`
        SELECT to_char(date_trunc('month', "memoDate"), 'YYYY-MM') as month, COUNT(*)::int as count
        FROM "Memo"
        WHERE "deletedAt" IS NULL AND "memoDate" >= (CURRENT_DATE - INTERVAL '6 months')
          AND (
            "authorId" = ${user.id}::uuid
            OR EXISTS (
              SELECT 1 FROM "MemoRecipient" mr
              WHERE mr."memoId" = "Memo".id
                AND (mr."partyId" = ${user.id}::uuid OR mr."partyId" = ${user.departmentId}::uuid)
            )
          )
        GROUP BY month
        ORDER BY month ASC
      `;

  return {
    scope: isAdmin ? "ALL" : "SELF_AND_DEPARTMENT",
    totals,
    unfinishedTasks,
    unreadCount,
    categoryBreakdown,
    departmentBreakdown,
    trend,
    waitingApprovalPreview,
    recentActivity: recentActivity.map((h) => ({
      id: h.id,
      memoId: h.memoId,
      memoTitle: h.memo.title,
      memoNumber: h.memo.memoNumber,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      createdAt: h.createdAt,
    })),
  };
}
