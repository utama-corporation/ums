import React from "react";

export type BadgeColor = "green" | "red" | "orange" | "blue" | "gray";

const COLOR_CLASSES: Record<BadgeColor, string> = {
  green: "bg-[#e5f7ed] text-[#10834d]",
  red: "bg-[#fde7e8] text-[#d51b25]",
  orange: "bg-[#fff0dd] text-[#d97400]",
  blue: "bg-[#e8f1ff] text-[#0f64d8]",
  gray: "bg-[#eef1f5] text-[#5d6675]",
};

export function Badge({ label, color = "gray" }: { label: string; color?: BadgeColor }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${COLOR_CLASSES[color]}`}>
      {label}
    </span>
  );
}

interface StatusMeta {
  label: string;
  color: BadgeColor;
}

export const MEMO_STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { label: "Draft", color: "gray" },
  SUBMITTED: { label: "Diajukan", color: "blue" },
  WAITING_APPROVAL: { label: "Menunggu", color: "orange" },
  REVISION: { label: "Revisi", color: "orange" },
  REJECTED: { label: "Ditolak", color: "red" },
  CANCELLED: { label: "Dibatalkan", color: "gray" },
  APPROVED: { label: "Disetujui", color: "green" },
  OUTBOX: { label: "Terkirim", color: "blue" },
  PUBLISHED: { label: "Published", color: "green" },
  ARCHIVED: { label: "Diarsipkan", color: "gray" },
};

export function MemoStatusBadge({ status }: { status: string }) {
  const meta = MEMO_STATUS_META[status] ?? { label: status, color: "gray" as BadgeColor };
  return <Badge label={meta.label} color={meta.color} />;
}

export const TASK_STATUS_META: Record<string, StatusMeta> = {
  NOT_STARTED: { label: "Belum Dimulai", color: "gray" },
  IN_PROGRESS: { label: "Dikerjakan", color: "blue" },
  WAITING_VERIFICATION: { label: "Menunggu Verifikasi", color: "orange" },
  COMPLETED: { label: "Selesai", color: "green" },
  OVERDUE: { label: "Terlambat", color: "red" },
  CANCELLED: { label: "Dibatalkan", color: "gray" },
};

export function TaskStatusBadge({ status }: { status: string }) {
  const meta = TASK_STATUS_META[status] ?? { label: status, color: "gray" as BadgeColor };
  return <Badge label={meta.label} color={meta.color} />;
}

export const PRIORITY_META: Record<string, StatusMeta> = {
  NORMAL: { label: "Normal", color: "blue" },
  IMPORTANT: { label: "Penting", color: "orange" },
  URGENT: { label: "Mendesak", color: "red" },
  CRITICAL: { label: "Kritis", color: "red" },
};

export function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority] ?? { label: priority, color: "gray" as BadgeColor };
  return <Badge label={meta.label} color={meta.color} />;
}

export function ReadBadge({ read }: { read: boolean }) {
  return read ? <Badge label="Dibaca" color="green" /> : <Badge label="Belum Dibaca" color="blue" />;
}
