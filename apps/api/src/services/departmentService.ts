import { prisma } from "@ums/db";
import { BadRequestError, NotFoundError, ConflictError } from "../errors/AppError.js";
import { DepartmentCreateInput, DepartmentUpdateInput } from "@ums/contracts";
import { logAuditEvent } from "./auditService.js";

export async function checkDepartmentParentCycle(departmentId: string, candidateParentId: string): Promise<boolean> {
  if (departmentId === candidateParentId) return true;
  let currentParentId: string | null = candidateParentId;

  while (currentParentId) {
    const parentDept: { parentId: string | null } | null = await prisma.department.findUnique({
      where: { id: currentParentId },
      select: { parentId: true },
    });
    if (!parentDept) break;
    if (parentDept.parentId === departmentId) return true;
    currentParentId = parentDept.parentId;
  }

  return false;
}

export async function createDepartment(input: DepartmentCreateInput, actorId?: string) {
  const existingCode = await prisma.department.findUnique({ where: { code: input.code } });
  if (existingCode) {
    throw new ConflictError(`Department code ${input.code} already exists`);
  }

  if (input.parentId) {
    const parentExists = await prisma.department.findUnique({ where: { id: input.parentId } });
    if (!parentExists) throw new NotFoundError("Parent department not found");
  }

  const department = await prisma.department.create({
    data: {
      code: input.code,
      name: input.name,
      parentId: input.parentId || null,
      headUserId: input.headUserId || null,
    },
  });

  await logAuditEvent({
    actorId,
    action: "DEPARTMENT_CREATED",
    module: "master.department",
    resourceType: "Department",
    resourceId: department.id,
    afterData: department,
  });

  return department;
}

export async function updateDepartment(id: string, input: DepartmentUpdateInput, actorId?: string) {
  const department = await prisma.department.findUnique({ where: { id } });
  if (!department) throw new NotFoundError("Department not found");

  if (input.parentId !== undefined && input.parentId !== null) {
    const wouldCycle = await checkDepartmentParentCycle(id, input.parentId);
    if (wouldCycle) {
      throw new BadRequestError("Circular parent department relationship detected");
    }
  }

  const updated = await prisma.department.update({
    where: { id },
    data: {
      code: input.code,
      name: input.name,
      parentId: input.parentId,
      headUserId: input.headUserId,
      isActive: input.isActive,
    },
  });

  await logAuditEvent({
    actorId,
    action: "DEPARTMENT_UPDATED",
    module: "master.department",
    resourceType: "Department",
    resourceId: id,
    beforeData: department,
    afterData: updated,
  });

  return updated;
}

export async function listDepartments() {
  return prisma.department.findMany({
    include: {
      parent: true,
    },
    orderBy: { name: "asc" },
  });
}
