import { z } from "zod";
import { MemoPriorityEnum, MemoClassificationEnum } from "./memo.js";

export const MemoPartySchema = z.object({
  partyType: z.enum(["USER", "DEPARTMENT", "EXTERNAL"]),
  partyId: z.string().uuid().optional().nullable(),
  displayName: z.string().min(1),
  email: z.string().email().optional().nullable(),
});

export type MemoPartyInput = z.infer<typeof MemoPartySchema>;

export const MemoCreateDraftSchema = z.object({
  title: z.string().min(1, "Title is required"),
  categoryId: z.string().uuid(),
  memoTypeId: z.string().uuid(),
  priority: MemoPriorityEnum.default("NORMAL"),
  classification: MemoClassificationEnum.default("GENERAL"),
  deadline: z.string().datetime().optional().nullable(),
  bodyHtml: z.string().default(""),
  senders: z.array(MemoPartySchema).min(1, "At least one sender is required"),
  recipients: z.array(MemoPartySchema).min(1, "At least one recipient is required"),
  ccs: z.array(MemoPartySchema).default([]),
});

export type MemoCreateDraftInput = z.infer<typeof MemoCreateDraftSchema>;

export const MemoUpdateDraftSchema = z.object({
  title: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  memoTypeId: z.string().uuid().optional(),
  priority: MemoPriorityEnum.optional(),
  classification: MemoClassificationEnum.optional(),
  deadline: z.string().datetime().optional().nullable(),
  bodyHtml: z.string().optional(),
  lockVersion: z.number().int().optional(),
  senders: z.array(MemoPartySchema).optional(),
  recipients: z.array(MemoPartySchema).optional(),
  ccs: z.array(MemoPartySchema).optional(),
});

export type MemoUpdateDraftInput = z.infer<typeof MemoUpdateDraftSchema>;

export const MemoAutosaveSchema = z.object({
  bodyHtml: z.string(),
  lockVersion: z.number().int(),
});

export type MemoAutosaveInput = z.infer<typeof MemoAutosaveSchema>;

export const AttachmentInitiateSchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().int().min(1).max(25 * 1024 * 1024, "File size limit is 25MB"),
  mimeType: z.string().min(1),
});

export type AttachmentInitiateInput = z.infer<typeof AttachmentInitiateSchema>;

export const AttachmentCompleteSchema = z.object({
  checksumSha256: z.string().length(64, "Invalid SHA-256 checksum length"),
});

export type AttachmentCompleteInput = z.infer<typeof AttachmentCompleteSchema>;
