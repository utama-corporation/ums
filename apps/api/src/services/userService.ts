import { prisma } from "@ums/db";
import bcrypt from "bcryptjs";
import { NotFoundError, ConflictError } from "../errors/AppError.js";
import { UserCreateInput, UserUpdateInput } from "@ums/contracts";
import { logAuditEvent } from "./auditService.js";

export async function createUser(input: UserCreateInput, actorId?: string) {
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ username: input.username }, { email: input.email }] },
  });
  if (existingUser) {
    throw new ConflictError(
      existingUser.username === input.username ? "Username already in use" : "Email already in use"
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      employeeId: input.employeeId || null,
      mobilePhone: input.mobilePhone || null,
      companyId: input.companyId || null,
      departmentId: input.departmentId || null,
      position: input.position || null,
      credentials: {
        create: {
          passwordHash,
        },
      },
      userRoles: {
        create: input.roleIds.map((roleId) => ({ roleId })),
      },
    },
    include: {
      department: true,
      company: true,
      userRoles: { include: { role: true } },
    },
  });

  await logAuditEvent({
    actorId,
    action: "USER_CREATED",
    module: "master.user",
    resourceType: "User",
    resourceId: user.id,
    afterData: { id: user.id, username: user.username, email: user.email, fullName: user.fullName },
  });

  return user;
}

export async function updateUser(id: string, input: UserUpdateInput, actorId?: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("User not found");

  if (input.username || input.email) {
    const conflict = await prisma.user.findFirst({
      where: {
        id: { not: id },
        OR: [...(input.username ? [{ username: input.username }] : []), ...(input.email ? [{ email: input.email }] : [])],
      },
    });
    if (conflict) {
      throw new ConflictError(conflict.username === input.username ? "Username already in use" : "Email already in use");
    }
  }

  if (input.roleIds) {
    await prisma.userRole.deleteMany({ where: { userId: id } });
    await prisma.userRole.createMany({
      data: input.roleIds.map((roleId) => ({ userId: id, roleId })),
    });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      username: input.username,
      email: input.email,
      fullName: input.fullName,
      employeeId: input.employeeId,
      mobilePhone: input.mobilePhone,
      companyId: input.companyId,
      departmentId: input.departmentId,
      position: input.position,
      isActive: input.isActive,
    },
    include: {
      department: true,
      company: true,
      userRoles: { include: { role: true } },
    },
  });

  await logAuditEvent({
    actorId,
    action: "USER_UPDATED",
    module: "master.user",
    resourceType: "User",
    resourceId: id,
    beforeData: user,
    afterData: updated,
  });

  return updated;
}

export async function resetUserPassword(id: string, newPasswordPlain: string, actorId?: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new NotFoundError("User not found");

  const passwordHash = await bcrypt.hash(newPasswordPlain, 10);

  await prisma.userCredential.update({
    where: { userId: id },
    data: { passwordHash },
  });

  // Revoke active sessions upon password reset
  await prisma.session.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await logAuditEvent({
    actorId,
    action: "USER_PASSWORD_RESET",
    module: "master.user",
    resourceType: "User",
    resourceId: id,
  });
}

export async function listUsers(page = 1, limit = 10, search?: string) {
  const skip = (page - 1) * limit;
  const where = search
    ? {
        OR: [
          { username: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { fullName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      include: {
        department: true,
        company: true,
        userRoles: { include: { role: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { total, users };
}
