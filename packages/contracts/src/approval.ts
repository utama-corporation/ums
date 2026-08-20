import { z } from "zod";

export const ApprovalDecisionSchema = z.object({
  reason: z.string().optional(),
  pin: z.string().optional(),
});

export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionSchema>;

export const ApprovalRejectSchema = z.object({
  reason: z.string().min(3, "Reason is required when rejecting a memo"),
});

export type ApprovalRejectInput = z.infer<typeof ApprovalRejectSchema>;

export const ApprovalRevisionSchema = z.object({
  reason: z.string().min(3, "Reason is required when requesting revision"),
});

export type ApprovalRevisionInput = z.infer<typeof ApprovalRevisionSchema>;

export const ApprovalDelegateSchema = z.object({
  delegateUserId: z.string().uuid("Delegate user ID is required"),
  reason: z.string().min(3, "Reason is required for delegation"),
});

export type ApprovalDelegateInput = z.infer<typeof ApprovalDelegateSchema>;

export const ApprovalCommentSchema = z.object({
  comment: z.string().min(1, "Comment text is required"),
});

export type ApprovalCommentInput = z.infer<typeof ApprovalCommentSchema>;
