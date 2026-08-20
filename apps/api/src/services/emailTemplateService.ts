import { prisma } from "@ums/db";
import { NotFoundError } from "../errors/AppError.js";
import { EmailTemplateUpdateInput } from "@ums/contracts";
import { logAuditEvent } from "./auditService.js";

// Single source of truth for which notification types exist, which placeholder
// variables each one exposes, and the default copy that ships out of the box
// (used both by the seed script and to validate/describe templates to the admin UI).
export const EMAIL_TEMPLATE_DEFAULTS: Record<string, { subject: string; bodyHtml: string; variables: string[] }> = {
  APPROVAL_REQUIRED: {
    subject: "Memo Submitted for Approval: {{memoTitle}}",
    bodyHtml: "<h2>Pemberitahuan Persetujuan Memo</h2><p>Memo \"{{memoTitle}}\" telah diajukan dan membutuhkan tindakan persetujuan Anda.</p>",
    variables: ["memoTitle"],
  },
  MEMO_APPROVED: {
    subject: "Memo Disetujui: {{memoNumber}}",
    bodyHtml: "<h2>Memo Anda Telah Disetujui</h2><p>Memo dengan nomor resmi <strong>{{memoNumber}}</strong> telah disetujui penuh oleh para approver.</p>",
    variables: ["memoNumber", "memoTitle"],
  },
  TASK_ASSIGNED: {
    subject: "Tugas Baru: {{taskTitle}}",
    bodyHtml: "<h2>Tugas Baru</h2><p>Anda mendapat tugas baru \"{{taskTitle}}\" dari disposisi memo {{memoNumber}}.</p>",
    variables: ["taskTitle", "memoNumber", "memoTitle"],
  },
  TASK_VERIFICATION_REQUESTED: {
    subject: "Menunggu Verifikasi: {{taskTitle}}",
    bodyHtml: "<h2>Menunggu Verifikasi</h2><p>Tugas \"{{taskTitle}}\" telah dilaporkan selesai dan menunggu verifikasi Anda.</p>",
    variables: ["taskTitle"],
  },
  TASK_VERIFIED_COMPLETED: {
    subject: "Tugas Disetujui: {{taskTitle}}",
    bodyHtml: "<h2>Tugas Disetujui</h2><p>Tugas \"{{taskTitle}}\" telah diverifikasi dan disetujui selesai oleh pemberi tugas.</p>",
    variables: ["taskTitle"],
  },
  TASK_REWORK_REQUESTED: {
    subject: "Tugas Perlu Direvisi: {{taskTitle}}",
    bodyHtml: "<h2>Tugas Perlu Direvisi</h2><p>Tugas \"{{taskTitle}}\" dikembalikan untuk dikerjakan ulang. Catatan: {{comment}}</p>",
    variables: ["taskTitle", "comment"],
  },
  TASK_OVERDUE: {
    subject: "Tugas Terlambat: {{taskTitle}}",
    bodyHtml: "<h2>Tugas Terlambat</h2><p>Tugas \"{{taskTitle}}\" telah melewati batas waktu (deadline) dan ditandai terlambat.</p>",
    variables: ["taskTitle"],
  },
};

export async function listEmailTemplates() {
  const rows = await prisma.emailTemplate.findMany();
  const byType = new Map(rows.map((r) => [r.notificationType, r]));

  return Object.entries(EMAIL_TEMPLATE_DEFAULTS).map(([notificationType, def]) => {
    const row = byType.get(notificationType);
    return {
      notificationType,
      subject: row?.subject ?? def.subject,
      bodyHtml: row?.bodyHtml ?? def.bodyHtml,
      variables: def.variables,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

export async function updateEmailTemplate(notificationType: string, input: EmailTemplateUpdateInput, actorId?: string) {
  if (!EMAIL_TEMPLATE_DEFAULTS[notificationType]) {
    throw new NotFoundError(`Unknown notification type: ${notificationType}`);
  }

  const before = await prisma.emailTemplate.findUnique({ where: { notificationType } });

  const updated = await prisma.emailTemplate.upsert({
    where: { notificationType },
    update: { subject: input.subject, bodyHtml: input.bodyHtml },
    create: { notificationType, subject: input.subject, bodyHtml: input.bodyHtml },
  });

  await logAuditEvent({
    actorId,
    action: "EMAIL_TEMPLATE_UPDATED",
    module: "settings",
    resourceType: "EmailTemplate",
    resourceId: updated.id,
    beforeData: before,
    afterData: updated,
  });

  return updated;
}
