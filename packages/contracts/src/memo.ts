import { z } from "zod";

export const MemoPriorityEnum = z.enum(["NORMAL", "IMPORTANT", "URGENT", "CRITICAL"]);
export type MemoPriority = z.infer<typeof MemoPriorityEnum>;

export const MemoClassificationEnum = z.enum(["GENERAL", "INTERNAL", "CONFIDENTIAL", "HIGHLY_CONFIDENTIAL"]);
export type MemoClassification = z.infer<typeof MemoClassificationEnum>;

export const MemoStatusEnum = z.enum([
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
]);
export type MemoStatus = z.infer<typeof MemoStatusEnum>;
