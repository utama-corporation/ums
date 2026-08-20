import { prisma } from "@ums/db";
import { ReportType } from "@ums/contracts";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@ums/config";
import crypto from "crypto";

const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

export interface ExportRequestedPayload {
  exportJobId: string;
  userId: string;
  userRoles: string[];
  userDepartmentId: string | null;
  reportType: ReportType;
  exportType: "CSV" | "XLSX" | "PDF";
  filters: Record<string, unknown>;
}

const ADMIN_ROLES = ["SUPER_ADMIN", "MEMO_ADMIN", "AUDITOR"];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return lines.join("\n");
}

async function buildReportRows(payload: ExportRequestedPayload): Promise<{ headers: string[]; rows: unknown[][] }> {
  const isAdmin = payload.userRoles.some((r) => ADMIN_ROLES.includes(r));
  const { userId, userDepartmentId } = payload;

  switch (payload.reportType) {
    case "incoming":
    case "outgoing": {
      const where =
        payload.reportType === "outgoing"
          ? { deletedAt: null, authorId: userId }
          : {
              deletedAt: null,
              recipients: { some: { partyId: userDepartmentId ? { in: [userId, userDepartmentId] } : userId } },
            };
      const memos = await prisma.memo.findMany({
        where,
        orderBy: { memoDate: "desc" },
        take: 5000,
        select: { memoNumber: true, title: true, status: true, priority: true, classification: true, memoDate: true },
      });
      return {
        headers: ["Memo Number", "Title", "Status", "Priority", "Classification", "Memo Date"],
        rows: memos.map((m) => [m.memoNumber, m.title, m.status, m.priority, m.classification, m.memoDate]),
      };
    }

    case "status": {
      const groups = await prisma.memo.groupBy({
        by: ["status"],
        where: isAdmin ? { deletedAt: null } : { deletedAt: null, authorId: userId },
        _count: { _all: true },
      });
      return { headers: ["Status", "Count"], rows: groups.map((g) => [g.status, g._count._all]) };
    }

    case "approval": {
      const groups = await prisma.approvalAssignment.groupBy({
        by: ["status"],
        where: isAdmin ? {} : { approverId: userId },
        _count: { _all: true },
      });
      return { headers: ["Approval Status", "Count"], rows: groups.map((g) => [g.status, g._count._all]) };
    }

    case "late": {
      const tasks = await prisma.task.findMany({
        where: {
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          deadline: { lt: new Date() },
          ...(isAdmin ? {} : { assignees: { some: { userId } } }),
        },
        select: { title: true, status: true, priority: true, deadline: true },
        take: 5000,
      });
      return {
        headers: ["Task Title", "Status", "Priority", "Deadline"],
        rows: tasks.map((t) => [t.title, t.status, t.priority, t.deadline]),
      };
    }

    case "unread": {
      const items = await prisma.distributionRecipient.findMany({
        where: { recipientUserId: userId, readReceipts: { none: { userId } } },
        include: { distribution: { include: { memo: { select: { title: true, memoNumber: true, priority: true } } } } },
        take: 5000,
      });
      return {
        headers: ["Memo Number", "Title", "Priority", "Distributed At"],
        rows: items.map((r) => [r.distribution.memo.memoNumber, r.distribution.memo.title, r.distribution.memo.priority, r.distribution.distributedAt]),
      };
    }

    case "task": {
      const groups = await prisma.task.groupBy({
        by: ["status"],
        where: isAdmin ? {} : { assignees: { some: { userId } } },
        _count: { _all: true },
      });
      return { headers: ["Task Status", "Count"], rows: groups.map((g) => [g.status, g._count._all]) };
    }

    case "category": {
      const groups = await prisma.memo.groupBy({
        by: ["categoryId"],
        where: isAdmin ? { deletedAt: null } : { deletedAt: null, authorId: userId },
        _count: { _all: true },
      });
      const categories = await prisma.category.findMany({ where: { id: { in: groups.map((g) => g.categoryId) } } });
      const nameById = new Map(categories.map((c) => [c.id, c.name]));
      return {
        headers: ["Category", "Count"],
        rows: groups.map((g) => [nameById.get(g.categoryId) ?? "Unknown", g._count._all]),
      };
    }

    case "department": {
      if (!isAdmin) {
        return { headers: ["Department", "Count"], rows: [] };
      }
      const rows = await prisma.$queryRaw<{ departmentName: string | null; count: number }[]>`
        SELECT d.name as "departmentName", COUNT(m.id)::int as count
        FROM "Memo" m
        JOIN "User" u ON u.id = m."authorId"
        LEFT JOIN "Department" d ON d.id = u."departmentId"
        WHERE m."deletedAt" IS NULL
        GROUP BY d.name
        ORDER BY count DESC
      `;
      return { headers: ["Department", "Count"], rows: rows.map((r) => [r.departmentName ?? "Unassigned", r.count]) };
    }

    case "user-activity": {
      const events = await prisma.auditEvent.findMany({
        orderBy: { timestamp: "desc" },
        take: 5000,
        select: { action: true, module: true, resourceType: true, actorId: true, timestamp: true },
      });
      return {
        headers: ["Action", "Module", "Resource Type", "Actor ID", "Timestamp"],
        rows: events.map((e) => [e.action, e.module, e.resourceType, e.actorId, e.timestamp]),
      };
    }

    default:
      return { headers: [], rows: [] };
  }
}

export async function processExportRequested(payload: ExportRequestedPayload) {
  const job = await prisma.exportJob.findUnique({ where: { id: payload.exportJobId } });
  if (!job) {
    console.warn(`[EXPORT_WORKER] Export job ${payload.exportJobId} not found, skipping`);
    return;
  }

  await prisma.exportJob.update({ where: { id: job.id }, data: { status: "PROCESSING" } });

  if (payload.exportType !== "CSV") {
    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorLog: `Export format ${payload.exportType} is not implemented yet. Only CSV is currently supported.`,
      },
    });
    console.warn(`[EXPORT_WORKER] Export job ${job.id} failed: unsupported format ${payload.exportType}`);
    return;
  }

  try {
    const { headers, rows } = await buildReportRows(payload);
    const csvContent = toCsv(headers, rows);
    const objectKey = `exports/${payload.userId}/${payload.reportType}-${crypto.randomUUID()}.csv`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: objectKey,
        Body: csvContent,
        ContentType: "text/csv",
      })
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        fileObjectKey: objectKey,
        rowCount: rows.length,
        expiresAt,
        completedAt: new Date(),
      },
    });

    console.log(`[EXPORT_WORKER] Export job ${job.id} completed with ${rows.length} rows -> ${objectKey}`);
  } catch (error) {
    await prisma.exportJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorLog: error instanceof Error ? error.stack ?? error.message : String(error),
      },
    });
    throw error;
  }
}
