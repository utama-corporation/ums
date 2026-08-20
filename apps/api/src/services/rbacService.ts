import { prisma } from "@ums/db";
import { NotFoundError } from "../errors/AppError.js";
import { RoleCreateInput } from "@ums/contracts";
import { logAuditEvent } from "./auditService.js";

export async function listRoles() {
  return prisma.role.findMany({
    include: {
      rolePermissions: {
        include: { permission: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function listPermissions() {
  return prisma.permission.findMany({
    orderBy: { module: "asc" },
  });
}

export async function createRole(input: RoleCreateInput, actorId?: string) {
  const role = await prisma.role.create({
    data: {
      name: input.name,
      description: input.description || null,
    },
  });

  if (input.permissionCodes.length > 0) {
    const permissions = await prisma.permission.findMany({
      where: { code: { in: input.permissionCodes } },
    });

    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }

  await logAuditEvent({
    actorId,
    action: "ROLE_CREATED",
    module: "master.role",
    resourceType: "Role",
    resourceId: role.id,
    afterData: role,
  });

  return role;
}

export async function updateRolePermissions(roleId: string, permissionCodes: string[], actorId?: string) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new NotFoundError("Role not found");

  const permissions = await prisma.permission.findMany({
    where: { code: { in: permissionCodes } },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId } });
  await prisma.rolePermission.createMany({
    data: permissions.map((p) => ({ roleId, permissionId: p.id })),
  });

  await logAuditEvent({
    actorId,
    action: "ROLE_PERMISSIONS_UPDATED",
    module: "master.role",
    resourceType: "Role",
    resourceId: roleId,
    afterData: { permissionCodes },
  });
}
