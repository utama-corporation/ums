import { prisma, Prisma } from "@ums/db";
import { SearchQuery, UserProfile } from "@ums/contracts";

const ADMIN_ROLES = ["SUPER_ADMIN", "MEMO_ADMIN", "AUDITOR"];

function isPrivilegedScope(user: UserProfile): boolean {
  return user.roles.some((r) => ADMIN_ROLES.includes(r));
}

function canViewMemoSummary(
  memo: { authorId: string; classification: string; recipients: { partyId: string | null }[] },
  user: UserProfile,
  isAdmin: boolean
): boolean {
  if (memo.classification !== "CONFIDENTIAL" && memo.classification !== "HIGHLY_CONFIDENTIAL") return true;
  if (isAdmin) return true;
  if (memo.authorId === user.id) return true;
  return memo.recipients.some((r) => r.partyId === user.id || (user.departmentId && r.partyId === user.departmentId));
}

export async function searchMemos(user: UserProfile, query: SearchQuery) {
  const isAdmin = isPrivilegedScope(user);

  const where: Prisma.MemoWhereInput = { deletedAt: null };

  if (!isAdmin) {
    where.OR = [
      { authorId: user.id },
      { recipients: { some: { partyId: user.id } } },
      ...(user.departmentId ? [{ recipients: { some: { partyId: user.departmentId } } }] : []),
    ];
  }

  if (query.status) where.status = query.status;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.priority) where.priority = query.priority;
  if (query.classification) where.classification = query.classification;
  if (query.departmentId) {
    where.recipients = { some: { partyId: query.departmentId } };
  }
  if (query.dateFrom || query.dateTo) {
    where.memoDate = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
    };
  }

  if (query.q && query.q.length > 0) {
    const likeTerm = `%${query.q}%`;
    const matches = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Memo"
      WHERE to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("memoNumber", ''))
            @@ plainto_tsquery('simple', ${query.q})
         OR "title" ILIKE ${likeTerm}
         OR "memoNumber" ILIKE ${likeTerm}
    `;
    const matchedIds = matches.map((m) => m.id);
    if (matchedIds.length === 0) {
      return { total: 0, items: [], page: query.page, limit: query.limit };
    }
    where.id = { in: matchedIds };
  }

  const skip = (query.page - 1) * query.limit;

  const [total, items] = await Promise.all([
    prisma.memo.count({ where }),
    prisma.memo.findMany({
      where,
      skip,
      take: query.limit,
      include: { category: true, memoType: true, senders: true, recipients: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const visible = items.filter((m) => canViewMemoSummary(m, user, isAdmin));

  return { total, items: visible, page: query.page, limit: query.limit };
}
