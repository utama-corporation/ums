import { z } from "zod";

export const TaskCreateSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  instruction: z.string().min(1, "Instruction is required"),
  priority: z.enum(["NORMAL", "IMPORTANT", "URGENT", "CRITICAL"]).default("NORMAL"),
  deadline: z.string().datetime().optional().nullable(),
  assigneeUserIds: z.array(z.string().uuid()).min(1, "At least one assignee is required"),
});

export const DispositionCreateSchema = z.object({
  instruction: z.string().min(1, "Disposition instruction is required"),
  tasks: z.array(TaskCreateSchema).min(1, "At least one task is required"),
});

export type DispositionCreateInput = z.infer<typeof DispositionCreateSchema>;

export const TaskProgressUpdateSchema = z.object({
  progress: z.number().int().min(0).max(100),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "WAITING_VERIFICATION", "COMPLETED"]),
  comment: z.string().optional(),
});

export type TaskProgressUpdateInput = z.infer<typeof TaskProgressUpdateSchema>;

export const TaskVerifySchema = z.object({
  action: z.enum(["APPROVE_COMPLETED", "REJECT_REWORK"]),
  comment: z.string().optional(),
});

export type TaskVerifyInput = z.infer<typeof TaskVerifySchema>;
