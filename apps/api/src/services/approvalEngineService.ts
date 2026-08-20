import { prisma } from "@ums/db";
import { BadRequestError, NotFoundError, ForbiddenError } from "../errors/AppError.js";
import { allocateNextMemoNumber } from "./numberingService.js";
import { UserProfile } from "@ums/contracts";

export async function resolveApproversForStep(rule: { strategy: string; targetId?: string | null }, authorId: string, deptId?: string | null): Promise<string[]> {
  if (rule.strategy === "USER" && rule.targetId) {
    return [rule.targetId];
  }

  if (rule.strategy === "ROLE" && rule.targetId) {
    const userRoles = await prisma.userRole.findMany({
      where: { roleId: rule.targetId, user: { isActive: true } },
      select: { userId: true },
    });
    return userRoles.map((ur) => ur.userId);
  }

  if (rule.strategy === "DEPARTMENT_HEAD" && deptId) {
    const dept = await prisma.department.findUnique({ where: { id: deptId } });
    if (dept?.headUserId) return [dept.headUserId];
  }

  if (rule.strategy === "MANAGER_OF_REQUESTER" && deptId) {
    const dept = await prisma.department.findUnique({ where: { id: deptId } });
    if (dept?.headUserId) return [dept.headUserId];
  }

  return [];
}

export async function submitMemoForApproval(memoId: string, user: UserProfile, idempotencyKey?: string) {
  return prisma.$transaction(async (tx) => {
    const memo = await tx.memo.findUnique({
      where: { id: memoId },
      include: {
        category: true,
        memoType: true,
        senders: true,
        recipients: true,
        attachments: { include: { attachmentObject: true } },
      },
    });

    if (!memo || memo.deletedAt) throw new NotFoundError("Memo not found");

    if (!["DRAFT", "REVISION"].includes(memo.status)) {
      throw new ForbiddenError(`Cannot submit memo with status ${memo.status}`);
    }

    if (!memo.title || !memo.senders.length || !memo.recipients.length) {
      throw new BadRequestError("Memo title, senders, and recipients are required for submission");
    }

    // Check attachment readiness
    const unreadyAttachment = memo.attachments.find((a) => a.attachmentObject.status !== "READY");
    if (unreadyAttachment) {
      throw new BadRequestError(`Attachment '${unreadyAttachment.attachmentObject.fileName}' is not ready or quarantined.`);
    }

    // Find active workflow version for category or default fallback
    const activeWorkflow = await tx.workflowDefinitionVersion.findFirst({
      where: {
        status: "ACTIVE",
        workflowDefinition: {
          OR: [
            { categoryId: memo.categoryId },
            { categoryId: null },
          ],
        },
      },
      include: {
        steps: {
          include: { approverRules: true, conditions: true },
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    // If zero approval steps required, approve directly
    if (!activeWorkflow || activeWorkflow.steps.length === 0) {
      const updatedMemo = await tx.memo.update({
        where: { id: memoId },
        data: { status: "APPROVED" },
      });

      await tx.memoStatusHistory.create({
        data: { memoId, fromStatus: memo.status, toStatus: "APPROVED", actorId: user.id, reason: "Auto-approved (0 workflow steps)" },
      });

      await tx.domainOutboxEvent.create({
        data: {
          eventType: "MEMO_APPROVED",
          aggregateType: "Memo",
          aggregateId: memoId,
          payloadJson: JSON.stringify({ memoId, status: "APPROVED" }),
        },
      });

      return { memo: updatedMemo, status: "APPROVED" };
    }

    // Create WorkflowInstance snapshot
    const workflowInstance = await tx.workflowInstance.create({
      data: {
        memoId,
        workflowDefinitionVersionId: activeWorkflow.id,
        status: "RUNNING",
        currentStepOrder: 1,
      },
    });

    // Create runtime steps
    for (const step of activeWorkflow.steps) {
      const isFirstStep = step.stepOrder === 1;
      const instanceStep = await tx.workflowInstanceStep.create({
        data: {
          workflowInstanceId: workflowInstance.id,
          stepOrder: step.stepOrder,
          name: step.name,
          mode: step.mode,
          parallelPolicy: step.parallelPolicy,
          requireSignature: step.requireSignature,
          slaHours: step.slaHours,
          status: isFirstStep ? "ACTIVE" : "PENDING",
          activatedAt: isFirstStep ? new Date() : null,
        },
      });

      if (isFirstStep) {
        let approverIds: string[] = [];
        for (const rule of step.approverRules) {
          const resolved = await resolveApproversForStep(rule, memo.authorId, user.departmentId);
          approverIds.push(...resolved);
        }
        approverIds = Array.from(new Set(approverIds));

        if (approverIds.length === 0) {
          // Fallback if no approver resolved: assign to Super Admin or author
          approverIds = [user.id];
        }

        for (const approverId of approverIds) {
          await tx.approvalAssignment.create({
            data: {
              workflowInstanceStepId: instanceStep.id,
              approverId,
              status: "PENDING",
            },
          });
        }
      }
    }

    // Transition memo to WAITING_APPROVAL
    const updatedMemo = await tx.memo.update({
      where: { id: memoId },
      data: { status: "WAITING_APPROVAL" },
    });

    await tx.memoStatusHistory.create({
      data: { memoId, fromStatus: memo.status, toStatus: "WAITING_APPROVAL", actorId: user.id, reason: "Submitted for approval" },
    });

    await tx.domainOutboxEvent.create({
      data: {
        eventType: "MEMO_SUBMITTED",
        aggregateType: "Memo",
        aggregateId: memoId,
        payloadJson: JSON.stringify({ memoId, status: "WAITING_APPROVAL", idempotencyKey }),
      },
    });

    return { memo: updatedMemo, workflowInstanceId: workflowInstance.id, status: "WAITING_APPROVAL" };
  });
}

export async function processApprovalDecision(
  assignmentId: string,
  action: "APPROVE" | "REJECT" | "REQUEST_REVISION",
  user: UserProfile,
  reason?: string,
  ipAddress?: string,
  userAgent?: string
) {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.approvalAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        workflowStep: {
          include: {
            workflowInstance: {
              include: {
                memo: true,
                steps: {
                  include: { assignments: true },
                  orderBy: { stepOrder: "asc" },
                },
              },
            },
            assignments: true,
          },
        },
      },
    });

    if (!assignment) throw new NotFoundError("Approval assignment not found");

    if (assignment.approverId !== user.id && !user.roles.includes("SUPER_ADMIN")) {
      throw new ForbiddenError("Not authorized to approve this step");
    }

    if (assignment.status !== "PENDING" || assignment.workflowStep.status !== "ACTIVE") {
      throw new ForbiddenError("Approval step is not active or has already been completed");
    }

    const memo = assignment.workflowStep.workflowInstance.memo;

    // 1. Record Append-only Decision
    await tx.approvalDecision.create({
      data: {
        approvalAssignmentId: assignmentId,
        action,
        reason: reason || null,
        memoVersion: memo.currentVersion,
        ipAddress,
        userAgent,
      },
    });

    // Update assignment status
    await tx.approvalAssignment.update({
      where: { id: assignmentId },
      data: {
        status: action === "APPROVE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : "REVISION_REQUESTED",
        respondedAt: new Date(),
      },
    });

    // 2. Handle REJECT
    if (action === "REJECT") {
      if (!reason) throw new BadRequestError("Reason is required when rejecting a memo");

      await tx.workflowInstanceStep.update({
        where: { id: assignment.workflowInstanceStepId },
        data: { status: "REJECTED", completedAt: new Date() },
      });

      await tx.workflowInstance.update({
        where: { id: assignment.workflowStep.workflowInstanceId },
        data: { status: "REJECTED" },
      });

      await tx.memo.update({
        where: { id: memo.id },
        data: { status: "REJECTED" },
      });

      await tx.memoStatusHistory.create({
        data: { memoId: memo.id, fromStatus: memo.status, toStatus: "REJECTED", actorId: user.id, reason },
      });

      return { status: "REJECTED" };
    }

    // 3. Handle REQUEST_REVISION
    if (action === "REQUEST_REVISION") {
      if (!reason) throw new BadRequestError("Reason is required when requesting revision");

      await tx.workflowInstanceStep.update({
        where: { id: assignment.workflowInstanceStepId },
        data: { status: "SKIPPED", completedAt: new Date() },
      });

      await tx.workflowInstance.update({
        where: { id: assignment.workflowStep.workflowInstanceId },
        data: { status: "COMPLETED" },
      });

      await tx.memo.update({
        where: { id: memo.id },
        data: { status: "REVISION" },
      });

      await tx.memoStatusHistory.create({
        data: { memoId: memo.id, fromStatus: memo.status, toStatus: "REVISION", actorId: user.id, reason },
      });

      return { status: "REVISION" };
    }

    // 4. Handle APPROVE (Parallel Policy check)
    const currentStep = assignment.workflowStep;
    const allAssignments = currentStep.assignments;
    const approvedCount = allAssignments.filter((a) => a.id === assignmentId || a.status === "APPROVED").length;

    let isStepComplete = false;
    if (currentStep.parallelPolicy === "ANY") {
      isStepComplete = true;
    } else if (currentStep.parallelPolicy === "QUORUM") {
      isStepComplete = approvedCount >= Math.ceil(allAssignments.length / 2);
    } else {
      // ALL
      isStepComplete = approvedCount >= allAssignments.length;
    }

    if (isStepComplete) {
      await tx.workflowInstanceStep.update({
        where: { id: currentStep.id },
        data: { status: "APPROVED", completedAt: new Date() },
      });

      // Find next step
      const instanceSteps = assignment.workflowStep.workflowInstance.steps;
      const nextStep = instanceSteps.find((s) => s.stepOrder === currentStep.stepOrder + 1);

      if (nextStep) {
        // Activate next step
        await tx.workflowInstanceStep.update({
          where: { id: nextStep.id },
          data: { status: "ACTIVE", activatedAt: new Date() },
        });

        await tx.workflowInstance.update({
          where: { id: assignment.workflowStep.workflowInstanceId },
          data: { currentStepOrder: nextStep.stepOrder },
        });

        // Resolve approvers for next step
        const activeVersion = await tx.workflowDefinitionVersion.findUnique({
          where: { id: assignment.workflowStep.workflowInstance.workflowDefinitionVersionId },
          include: { steps: { include: { approverRules: true } } },
        });

        const nextStepDef = activeVersion?.steps.find((s) => s.stepOrder === nextStep.stepOrder);
        let approverIds: string[] = [];

        for (const rule of nextStepDef?.approverRules || []) {
          const resolved = await resolveApproversForStep(rule, memo.authorId, user.departmentId);
          approverIds.push(...resolved);
        }
        approverIds = Array.from(new Set(approverIds));

        if (approverIds.length === 0) approverIds = [user.id];

        for (const approverId of approverIds) {
          await tx.approvalAssignment.create({
            data: {
              workflowInstanceStepId: nextStep.id,
              approverId,
              status: "PENDING",
            },
          });
        }

        return { status: "STEP_APPROVED", nextStepOrder: nextStep.stepOrder };
      } else {
        // All steps completed! Transition Memo -> APPROVED
        await tx.workflowInstance.update({
          where: { id: assignment.workflowStep.workflowInstanceId },
          data: { status: "COMPLETED" },
        });

        // Auto-allocate memo number if numbering rule exists
        const defaultRule = await tx.memoNumberingRule.findFirst({ where: { isActive: true } });
        let allocatedNumber = memo.memoNumber;

        if (!allocatedNumber && defaultRule) {
          allocatedNumber = await allocateNextMemoNumber(defaultRule.id, "HR", "MEMO");
        }

        await tx.memo.update({
          where: { id: memo.id },
          data: { status: "APPROVED", memoNumber: allocatedNumber },
        });

        await tx.memoStatusHistory.create({
          data: { memoId: memo.id, fromStatus: memo.status, toStatus: "APPROVED", actorId: user.id, reason: "All approval steps completed" },
        });

        await tx.domainOutboxEvent.create({
          data: {
            eventType: "MEMO_APPROVED",
            aggregateType: "Memo",
            aggregateId: memo.id,
            payloadJson: JSON.stringify({ memoId: memo.id, status: "APPROVED", memoNumber: allocatedNumber }),
          },
        });

        return { status: "APPROVED", memoNumber: allocatedNumber };
      }
    }

    return { status: "ASSIGNMENT_APPROVED", approvedCount };
  });
}
