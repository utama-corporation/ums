import { prisma } from "@ums/db";
import bcrypt from "bcryptjs";
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from "../errors/AppError.js";
import { UserCreateInput, UserUpdateInput, SetInitialPasswordInput } from "@ums/contracts";
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

  // No initial password -> the user sets their own on first login, verified against their
  // NIK instead (see setInitialPassword below). Without a NIK on file that path has no way
  // to verify identity, so the account would be permanently unable to log in — require one.
  if (!input.password && !input.employeeId) {
    throw new BadRequestError("Either an initial password or a NIK (for the user to set their own) is required");
  }

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
      ...(input.password
        ? { credentials: { create: { passwordHash: await bcrypt.hash(input.password, 10) } } }
        : {}),
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

  // upsert, not update: a user created without an initial password (see createUser) has no
  // UserCredential row yet, and an admin should still be able to set one for them directly.
  await prisma.userCredential.upsert({
    where: { userId: id },
    update: { passwordHash },
    create: { userId: id, passwordHash },
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

// The self-service counterpart to resetUserPassword: no admin session, no old password to
// check (there isn't one yet) — the caller proves identity with their NIK instead. Only
// succeeds once, while the account still genuinely has no credentials; an existing password
// must go through the normal login+change flow or an admin reset, not this endpoint.
export async function setInitialPassword(input: SetInitialPasswordInput) {
  const user = await prisma.user.findUnique({
    where: { username: input.username },
    include: { credentials: true },
  });

  if (!user || !user.isActive) {
    throw new NotFoundError("Account not found or inactive");
  }
  if (user.credentials) {
    throw new ForbiddenError("This account already has a password set. Use the login form or contact an admin to reset it.");
  }
  if (!user.employeeId || user.employeeId !== input.employeeId) {
    throw new ForbiddenError("NIK does not match this account");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await prisma.userCredential.create({
    data: { userId: user.id, passwordHash },
  });

  await logAuditEvent({
    actorId: user.id,
    action: "USER_INITIAL_PASSWORD_SET",
    module: "auth",
    resourceType: "User",
    resourceId: user.id,
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
