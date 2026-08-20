import { z } from "zod";

export const CompanyProfileUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
});

export type CompanyProfileUpdateInput = z.infer<typeof CompanyProfileUpdateSchema>;

export const SecurityPolicySchema = z.object({
  accessTokenTtlMinutes: z.number().int().min(1).max(1440),
  refreshTokenTtlDays: z.number().int().min(1).max(90),
});

export type SecurityPolicyInput = z.infer<typeof SecurityPolicySchema>;

export const CategorySchema = z.object({
  code: z.string().min(2).toUpperCase(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
});

export type CategoryInput = z.infer<typeof CategorySchema>;

export const CategoryUpdateSchema = z.object({
  code: z.string().min(2).toUpperCase().optional(),
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CategoryUpdateInput = z.infer<typeof CategoryUpdateSchema>;

export const MemoTypeSchema = z.object({
  code: z.string().min(2).toUpperCase(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
});

export type MemoTypeInput = z.infer<typeof MemoTypeSchema>;

export const MemoTypeUpdateSchema = z.object({
  code: z.string().min(2).toUpperCase().optional(),
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type MemoTypeUpdateInput = z.infer<typeof MemoTypeUpdateSchema>;

export const MemoNumberingRuleSchema = z.object({
  name: z.string().min(2),
  formatPattern: z.string().min(3), // e.g. "{SEQUENCE}/{DEPT}/{TYPE}/{ROMAN_MONTH}/{YEAR}"
  resetFrequency: z.enum(["YEARLY", "MONTHLY"]).default("YEARLY"),
  paddingDigits: z.number().int().min(1).max(8).default(4),
});

export type MemoNumberingRuleInput = z.infer<typeof MemoNumberingRuleSchema>;

export const MemoNumberingRuleUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  formatPattern: z.string().min(3).optional(),
  resetFrequency: z.enum(["YEARLY", "MONTHLY"]).optional(),
  paddingDigits: z.number().int().min(1).max(8).optional(),
  isActive: z.boolean().optional(),
});

export type MemoNumberingRuleUpdateInput = z.infer<typeof MemoNumberingRuleUpdateSchema>;

export const WorkflowApproverRuleSchema = z.object({
  strategy: z.enum(["USER", "ROLE", "DEPARTMENT_HEAD", "MANAGER_OF_REQUESTER"]),
  targetId: z.string().uuid().optional().nullable(),
});

export const WorkflowConditionSchema = z.object({
  field: z.enum(["priority", "classification", "amount"]),
  operator: z.enum(["EQUALS", "GREATER_THAN", "IN"]),
  value: z.string(),
});

export const WorkflowStepSchema = z.object({
  stepOrder: z.number().int().min(1),
  name: z.string().min(2),
  mode: z.enum(["SEQUENTIAL", "PARALLEL"]).default("SEQUENTIAL"),
  parallelPolicy: z.enum(["ALL", "ANY", "QUORUM"]).default("ALL"),
  requireSignature: z.boolean().default(false),
  slaHours: z.number().int().optional().nullable(),
  approverRules: z.array(WorkflowApproverRuleSchema).min(1, "Step must have at least one approver rule"),
  conditions: z.array(WorkflowConditionSchema).default([]),
});

export type WorkflowStepInput = z.infer<typeof WorkflowStepSchema>;

export const WorkflowDefinitionSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  steps: z.array(WorkflowStepSchema).min(1, "Workflow must have at least one step"),
});

export type WorkflowDefinitionInput = z.infer<typeof WorkflowDefinitionSchema>;
