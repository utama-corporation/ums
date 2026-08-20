import { prisma } from "@ums/db";
import { BadRequestError, NotFoundError } from "../errors/AppError.js";
import { WorkflowDefinitionInput, WorkflowStepInput } from "@ums/contracts";
import { logAuditEvent } from "./auditService.js";

export function validateWorkflowSteps(steps: WorkflowStepInput[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!steps || steps.length === 0) {
    errors.push("Workflow must contain at least one step.");
    return { valid: false, errors };
  }

  // Check step orders are sequential 1, 2, 3...
  const sortedOrders = steps.map((s) => s.stepOrder).sort((a, b) => a - b);
  for (let i = 0; i < sortedOrders.length; i++) {
    if (sortedOrders[i] !== i + 1) {
      errors.push(`Step orders must be sequential starting from 1. Found order ${sortedOrders[i]} at position ${i + 1}.`);
    }
  }

  for (const step of steps) {
    if (!step.approverRules || step.approverRules.length === 0) {
      errors.push(`Step ${step.stepOrder} (${step.name}) has no approver rules assigned.`);
    }

    for (const rule of step.approverRules || []) {
      if (["USER", "ROLE"].includes(rule.strategy) && !rule.targetId) {
        errors.push(`Step ${step.stepOrder} (${step.name}) has strategy '${rule.strategy}' but no target ID assigned.`);
      }
    }

    for (const cond of step.conditions || []) {
      if (!["priority", "classification", "amount"].includes(cond.field)) {
        errors.push(`Step ${step.stepOrder} has invalid condition field '${cond.field}'.`);
      }
      if (!["EQUALS", "GREATER_THAN", "IN"].includes(cond.operator)) {
        errors.push(`Step ${step.stepOrder} has invalid condition operator '${cond.operator}'.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function createWorkflowDefinition(input: WorkflowDefinitionInput, actorId?: string) {
  const validation = validateWorkflowSteps(input.steps);
  if (!validation.valid) {
    throw new BadRequestError("Invalid workflow steps configuration", validation.errors);
  }

  const workflow = await prisma.workflowDefinition.create({
    data: {
      name: input.name,
      description: input.description || null,
      categoryId: input.categoryId || null,
      versions: {
        create: {
          versionNumber: 1,
          status: "ACTIVE",
          steps: {
            create: input.steps.map((step) => ({
              stepOrder: step.stepOrder,
              name: step.name,
              mode: step.mode,
              parallelPolicy: step.parallelPolicy,
              requireSignature: step.requireSignature,
              slaHours: step.slaHours || null,
              approverRules: {
                create: step.approverRules.map((r) => ({
                  strategy: r.strategy,
                  targetId: r.targetId || null,
                })),
              },
              conditions: {
                create: step.conditions.map((c) => ({
                  field: c.field,
                  operator: c.operator,
                  value: c.value,
                })),
              },
            })),
          },
        },
      },
    },
    include: {
      versions: {
        include: {
          steps: {
            include: { approverRules: true, conditions: true },
          },
        },
      },
    },
  });

  await logAuditEvent({
    actorId,
    action: "WORKFLOW_CREATED",
    module: "master.workflow",
    resourceType: "WorkflowDefinition",
    resourceId: workflow.id,
  });

  return workflow;
}

export async function createNewWorkflowVersion(workflowId: string, steps: WorkflowStepInput[], actorId?: string) {
  const workflow = await prisma.workflowDefinition.findUnique({
    where: { id: workflowId },
    include: { versions: true },
  });
  if (!workflow) throw new NotFoundError("Workflow definition not found");

  const validation = validateWorkflowSteps(steps);
  if (!validation.valid) {
    throw new BadRequestError("Invalid workflow steps configuration", validation.errors);
  }

  const nextVersionNumber = Math.max(...workflow.versions.map((v) => v.versionNumber), 0) + 1;

  const version = await prisma.workflowDefinitionVersion.create({
    data: {
      workflowDefinitionId: workflowId,
      versionNumber: nextVersionNumber,
      status: "DRAFT",
      steps: {
        create: steps.map((step) => ({
          stepOrder: step.stepOrder,
          name: step.name,
          mode: step.mode,
          parallelPolicy: step.parallelPolicy,
          requireSignature: step.requireSignature,
          slaHours: step.slaHours || null,
          approverRules: {
            create: step.approverRules.map((r) => ({
              strategy: r.strategy,
              targetId: r.targetId || null,
            })),
          },
          conditions: {
            create: step.conditions.map((c) => ({
              field: c.field,
              operator: c.operator,
              value: c.value,
            })),
          },
        })),
      },
    },
    include: {
      steps: { include: { approverRules: true, conditions: true } },
    },
  });

  await logAuditEvent({
    actorId,
    action: "WORKFLOW_VERSION_CREATED",
    module: "master.workflow",
    resourceType: "WorkflowDefinitionVersion",
    resourceId: version.id,
  });

  return version;
}

export async function activateWorkflowVersion(versionId: string, actorId?: string) {
  const targetVersion = await prisma.workflowDefinitionVersion.findUnique({
    where: { id: versionId },
  });
  if (!targetVersion) throw new NotFoundError("Workflow version not found");

  // Deactivate all previous versions for this workflow definition
  await prisma.workflowDefinitionVersion.updateMany({
    where: {
      workflowDefinitionId: targetVersion.workflowDefinitionId,
      status: "ACTIVE",
    },
    data: { status: "ARCHIVED" },
  });

  const activated = await prisma.workflowDefinitionVersion.update({
    where: { id: versionId },
    data: { status: "ACTIVE" },
  });

  await logAuditEvent({
    actorId,
    action: "WORKFLOW_VERSION_ACTIVATED",
    module: "master.workflow",
    resourceType: "WorkflowDefinitionVersion",
    resourceId: versionId,
  });

  return activated;
}

export async function listWorkflows() {
  return prisma.workflowDefinition.findMany({
    include: {
      versions: {
        include: {
          steps: {
            include: { approverRules: true, conditions: true },
            orderBy: { stepOrder: "asc" },
          },
        },
        orderBy: { versionNumber: "desc" },
      },
    },
    orderBy: { name: "asc" },
  });
}
