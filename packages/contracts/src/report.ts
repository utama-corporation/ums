import { z } from "zod";

export const SearchQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  priority: z.string().optional(),
  classification: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const REPORT_TYPES = [
  "incoming",
  "outgoing",
  "status",
  "approval",
  "late",
  "unread",
  "task",
  "department",
  "category",
  "user-activity",
] as const;

export const ReportTypeSchema = z.enum(REPORT_TYPES);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const ReportQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ReportQuery = z.infer<typeof ReportQuerySchema>;

export const EXPORT_TYPES = ["CSV", "XLSX", "PDF"] as const;

export const ExportCreateSchema = z.object({
  reportType: ReportTypeSchema,
  exportType: z.enum(EXPORT_TYPES),
  filters: z.record(z.unknown()).optional().default({}),
});

export type ExportCreateInput = z.infer<typeof ExportCreateSchema>;
