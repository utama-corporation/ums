import { prisma, Prisma } from "@ums/db";
import { ReportQuery, ReportType, UserProfile } from "@ums/contracts";
import { ForbiddenError } from "../errors/AppError.js";

const ADMIN_ROLES = ["SUPER_ADMIN", "MEMO_ADMIN", "AUDITOR"];

function isPrivilegedScope(user: UserProfile): boolean {
  return user.roles.some((r) => ADMIN_ROLES.includes(r));
}

function dateRangeWhere(query: ReportQuery): Prisma.DateTimeFilter | undefined {
  if (!query.dateFrom && !query.dateTo) return undefined;
  return {
    ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
    ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
  };
}

async function reportIncoming(user: UserProfile, query: ReportQuery) {
  const skip = (query.page - 1) * query.limit;
  const where: Prisma.MemoWhereInput = {
    deletedAt: null,
    recipients: { some: { partyId: user.departmentId ? { in: [user.id, user.departmentId] } : user.id } },
    ...(dateRangeWhere(query) ? { memoDate: dateRangeWhere(query) } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.memo.count({ where }),
    prisma.memo.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { memoDate: "desc" },
      select: { id: true, title: true, memoNumber: true, status: true, priority: true, memoDate: true },
    }),
  ]);

  return { total, items, page: query.page, limit: query.limit };
}

async function reportOutgoing(user: UserProfile, query: ReportQuery) {
  const skip = (query.page - 1) * query.limit;
  const where: Prisma.MemoWhereInput = {
    deletedAt: null,
    authorId: user.id,
    ...(dateRangeWhere(query) ? { memoDate: dateRangeWhere(query) } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.memo.count({ where }),
    prisma.memo.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { memoDate: "desc" },
      select: { id: true, title: true, memoNumber: true, status: true, priority: true, memoDate: true },
    }),
  ]);

  return { total, items, page: query.page, limit: query.limit };
}

async function reportStatus(user: UserProfile, query: ReportQuery, isAdmin: boolean) {
  const where: Prisma.MemoWhereInput = {
    deletedAt: null,
    ...(isAdmin
      ? {}
      : {
          OR: [
            { authorId: user.id },
            { recipients: { some: { partyId: user.id } } },
            ...(user.departmentId ? [{ recipients: { some: { partyId: user.departmentId } } }] : []),
          ],
        }),
    ...(dateRangeWhere(query) ? { memoDate: dateRangeWhere(query) } : {}),
  };

  const groups = await prisma.memo.groupBy({ by: ["status"], where, _count: { _all: true } });
  return groups.reduce((acc, g) => ({ ...acc, [g.status]: g._count._all }), {} as Record<string, number>);
}

async function reportApproval(user: UserProfile, isAdmin: boolean) {
  const groups = await prisma.approvalAssignment.groupBy({
    by: ["status"],
    where: isAdmin ? {} : { approverId: user.id },
    _count: { _all: true },
  });
  return groups.reduce((acc, g) => ({ ...acc, [g.status]: g._count._all }), {} as Record<string, number>);
}

async function reportLate(user: UserProfile, isAdmin: boolean) {
  const now = Date.now();

  const activeSteps = await prisma.workflowInstanceStep.findMany({
    where: {
      status: "ACTIVE",
      slaHours: { not: null },
      ...(isAdmin ? {} : { assignments: { some: { approverId: user.id, status: "PENDING" } } }),
    },
    include: {
      workflowInstance: { include: { memo: { select: { id: true, title: true, memoNumber: true, priority: true } } } },
    },
    take: 100,
  });

  const overdueApprovals = activeSteps
    .filter((s) => s.activatedAt && s.slaHours && now - s.activatedAt.getTime() > s.slaHours * 3600000)
    .map((s) => ({
      memoId: s.workflowInstance.memo.id,
      memoTitle: s.workflowInstance.memo.title,
      memoNumber: s.workflowInstance.memo.memoNumber,
      stepName: s.name,
      activatedAt: s.activatedAt,
      slaHours: s.slaHours,
      hoursOverdue: Math.floor((now - s.activatedAt!.getTime()) / 3600000) - (s.slaHours as number),
    }));

  const overdueTasks = await prisma.task.findMany({
    where: {
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      deadline: { lt: new Date() },
      ...(isAdmin ? {} : { assignees: { some: { userId: user.id } } }),
    },
    select: { id: true, title: true, deadline: true, status: true, priority: true },
    take: 100,
  });

  return { overdueApprovals, overdueTasks };
}

async function reportUnread(user: UserProfile, query: ReportQuery) {
  const skip = (query.page - 1) * query.limit;
  const where: Prisma.DistributionRecipientWhereInput = {
    recipientUserId: user.id,
    readReceipts: { none: { userId: user.id } },
  };

  const [total, items] = await Promise.all([
    prisma.distributionRecipient.count({ where }),
    prisma.distributionRecipient.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: { distribution: { include: { memo: { select: { id: true, title: true, memoNumber: true, priority: true } } } } },
    }),
  ]);

  return {
    total,
    page: query.page,
    limit: query.limit,
    items: items.map((r) => ({
      distributionRecipientId: r.id,
      distributedAt: r.distribution.distributedAt,
      memo: r.distribution.memo,
    })),
  };
}

async function reportTask(user: UserProfile, isAdmin: boolean) {
  const groups = await prisma.task.groupBy({
    by: ["status"],
    where: isAdmin ? {} : { assignees: { some: { userId: user.id } } },
    _count: { _all: true },
  });
  return groups.reduce((acc, g) => ({ ...acc, [g.status]: g._count._all }), {} as Record<string, number>);
}

async function reportCategory(user: UserProfile, isAdmin: boolean) {
  const where: Prisma.MemoWhereInput = {
    deletedAt: null,
    ...(isAdmin
      ? {}
      : {
          OR: [
            { authorId: user.id },
            { recipients: { some: { partyId: user.id } } },
            ...(user.departmentId ? [{ recipients: { some: { partyId: user.departmentId } } }] : []),
          ],
        }),
  };

  const groups = await prisma.memo.groupBy({ by: ["categoryId"], where, _count: { _all: true } });
  const categories = await prisma.category.findMany({ where: { id: { in: groups.map((g) => g.categoryId) } } });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  return groups.map((g) => ({ categoryId: g.categoryId, categoryName: nameById.get(g.categoryId) ?? "Unknown", count: g._count._all }));
}

async function reportDepartment(user: UserProfile, isAdmin: boolean) {
  if (isAdmin) {
    return prisma.$queryRaw<{ departmentId: string | null; departmentName: string | null; count: number }[]>`
      SELECT u."departmentId" as "departmentId", d.name as "departmentName", COUNT(m.id)::int as count
      FROM "Memo" m
      JOIN "User" u ON u.id = m."authorId"
      LEFT JOIN "Department" d ON d.id = u."departmentId"
      WHERE m."deletedAt" IS NULL
      GROUP BY u."departmentId", d.name
      ORDER BY count DESC
    `;
  }

  if (!user.departmentId) return [];

  const deptUsers = await prisma.user.findMany({ where: { departmentId: user.departmentId }, select: { id: true } });
  const count = await prisma.memo.count({
    where: { deletedAt: null, authorId: { in: deptUsers.map((u) => u.id) } },
  });

  return [{ departmentId: user.departmentId, departmentName: user.departmentName ?? null, count }];
}

async function reportUserActivity(query: ReportQuery) {
  const skip = (query.page - 1) * query.limit;
  const where: Prisma.AuditEventWhereInput = dateRangeWhere(query) ? { timestamp: dateRangeWhere(query) } : {};

  const [total, items] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: { timestamp: "desc" },
      select: { id: true, actorId: true, action: true, module: true, resourceType: true, resourceId: true, timestamp: true },
    }),
  ]);

  return { total, items, page: query.page, limit: query.limit };
}

export async function getReport(type: ReportType, user: UserProfile, query: ReportQuery) {
  const isAdmin = isPrivilegedScope(user);

  switch (type) {
    case "incoming":
      return reportIncoming(user, query);
    case "outgoing":
      return reportOutgoing(user, query);
    case "status":
      return reportStatus(user, query, isAdmin);
    case "approval":
      return reportApproval(user, isAdmin);
    case "late":
      return reportLate(user, isAdmin);
    case "unread":
      return reportUnread(user, query);
    case "task":
      return reportTask(user, isAdmin);
    case "category":
      return reportCategory(user, isAdmin);
    case "department":
      return reportDepartment(user, isAdmin);
    case "user-activity":
      if (!user.permissions.includes("audit.view")) {
        throw new ForbiddenError("Permission denied: requires [audit.view]");
      }
      return reportUserActivity(query);
    default:
      throw new ForbiddenError("Unsupported report type");
  }
}
