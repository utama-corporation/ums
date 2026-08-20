import { z } from "zod";

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(50, "Username must be at most 50 characters")
  .regex(/^[a-zA-Z0-9._-]+$/, "Username may only contain letters, numbers, dot, underscore, and hyphen");

export const LoginRequestSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  employeeId: z.string().nullable().optional(),
  departmentId: z.string().uuid().nullable(),
  departmentName: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  isActive: z.boolean(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UserCreateSchema = z.object({
  username: usernameSchema,
  email: z.string().email("Invalid email format"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  employeeId: z.string().optional(),
  departmentId: z.string().uuid().optional().nullable(),
  position: z.string().optional().nullable(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleIds: z.array(z.string().uuid()).default([]),
});

export type UserCreateInput = z.infer<typeof UserCreateSchema>;

export const UserUpdateSchema = z.object({
  username: usernameSchema.optional(),
  email: z.string().email("Invalid email format").optional(),
  fullName: z.string().min(2).optional(),
  employeeId: z.string().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  position: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;

export const PasswordResetSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export type PasswordResetInput = z.infer<typeof PasswordResetSchema>;

export const DepartmentCreateSchema = z.object({
  code: z.string().min(2, "Code must be at least 2 characters").toUpperCase(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  parentId: z.string().uuid().optional().nullable(),
  headUserId: z.string().uuid().optional().nullable(),
});

export type DepartmentCreateInput = z.infer<typeof DepartmentCreateSchema>;

export const DepartmentUpdateSchema = z.object({
  code: z.string().min(2).toUpperCase().optional(),
  name: z.string().min(2).optional(),
  parentId: z.string().uuid().optional().nullable(),
  headUserId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type DepartmentUpdateInput = z.infer<typeof DepartmentUpdateSchema>;

export const RoleCreateSchema = z.object({
  name: z.string().min(2, "Role name is required"),
  description: z.string().optional(),
  permissionCodes: z.array(z.string()).default([]),
});

export type RoleCreateInput = z.infer<typeof RoleCreateSchema>;
