import { prisma } from "@ums/db";

// Kept in sync with apps/api/src/services/emailTemplateService.ts's EMAIL_TEMPLATE_DEFAULTS.
// Duplicated (not imported) because the Docker build prunes apps/api and apps/worker into
// separate images — a cross-app import here would build locally but break in production.
const DEFAULT_TEMPLATES: Record<string, { subject: string; bodyHtml: string }> = {
  APPROVAL_REQUIRED: {
    subject: "Memo Submitted for Approval: {{memoTitle}}",
    bodyHtml: "<h2>Pemberitahuan Persetujuan Memo</h2><p>Memo \"{{memoTitle}}\" telah diajukan dan membutuhkan tindakan persetujuan Anda.</p>",
  },
  MEMO_APPROVED: {
    subject: "Memo Disetujui: {{memoNumber}}",
    bodyHtml: "<h2>Memo Anda Telah Disetujui</h2><p>Memo dengan nomor resmi <strong>{{memoNumber}}</strong> telah disetujui penuh oleh para approver.</p>",
  },
  TASK_ASSIGNED: {
    subject: "Tugas Baru: {{taskTitle}}",
    bodyHtml: "<h2>Tugas Baru</h2><p>Anda mendapat tugas baru \"{{taskTitle}}\" dari disposisi memo {{memoNumber}}.</p>",
  },
  TASK_VERIFICATION_REQUESTED: {
    subject: "Menunggu Verifikasi: {{taskTitle}}",
    bodyHtml: "<h2>Menunggu Verifikasi</h2><p>Tugas \"{{taskTitle}}\" telah dilaporkan selesai dan menunggu verifikasi Anda.</p>",
  },
  TASK_VERIFIED_COMPLETED: {
    subject: "Tugas Disetujui: {{taskTitle}}",
    bodyHtml: "<h2>Tugas Disetujui</h2><p>Tugas \"{{taskTitle}}\" telah diverifikasi dan disetujui selesai oleh pemberi tugas.</p>",
  },
  TASK_REWORK_REQUESTED: {
    subject: "Tugas Perlu Direvisi: {{taskTitle}}",
    bodyHtml: "<h2>Tugas Perlu Direvisi</h2><p>Tugas \"{{taskTitle}}\" dikembalikan untuk dikerjakan ulang. Catatan: {{comment}}</p>",
  },
  TASK_OVERDUE: {
    subject: "Tugas Terlambat: {{taskTitle}}",
    bodyHtml: "<h2>Tugas Terlambat</h2><p>Tugas \"{{taskTitle}}\" telah melewati batas waktu (deadline) dan ditandai terlambat.</p>",
  },
};

let cache: { data: Map<string, { subject: string; bodyHtml: string }>; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000;

async function getTemplateMap(): Promise<Map<string, { subject: string; bodyHtml: string }>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;

  const rows = await prisma.emailTemplate.findMany();
  const map = new Map(Object.entries(DEFAULT_TEMPLATES));
  for (const row of rows) {
    map.set(row.notificationType, { subject: row.subject, bodyHtml: row.bodyHtml });
  }

  cache = { data: map, fetchedAt: Date.now() };
  return map;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => (key in vars ? escapeHtml(vars[key]) : ""));
}

export async function renderEmailTemplate(notificationType: string, vars: Record<string, string>): Promise<{ subject: string; bodyHtml: string } | null> {
  const map = await getTemplateMap();
  const template = map.get(notificationType);
  if (!template) return null;

  return {
    subject: render(template.subject, vars),
    bodyHtml: render(template.bodyHtml, vars),
  };
}
