import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { submitMemoForApproval, processApprovalDecision } from "../services/approvalEngineService.js";
import { ApprovalRejectSchema, ApprovalRevisionSchema } from "@ums/contracts";
import { prisma } from "@ums/db";

export const approvalsRouter: Router = Router();

// Submit Memo endpoint (mounted under /memos or /approvals)
approvalsRouter.post("/memos/:id/submit", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idempotencyKey = (req.headers["idempotency-key"] as string) || undefined;
    const result = await submitMemoForApproval(req.params.id, req.user!, idempotencyKey);

    res.status(200).json({
      success: true,
      message: "Memo submitted for approval successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Approver Inbox
approvalsRouter.get("/approvals/inbox", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const assignments = await prisma.approvalAssignment.findMany({
      where: {
        approverId: req.user!.id,
        status: "PENDING",
        workflowStep: {
          status: "ACTIVE",
        },
      },
      include: {
        workflowStep: {
          include: {
            workflowInstance: {
              include: {
                memo: {
                  include: {
                    category: true,
                    memoType: true,
                    senders: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (error) {
    next(error);
  }
});

// Approve step
approvalsRouter.post("/approval-assignments/:id/approve", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString();
    const userAgent = req.headers["user-agent"];
    const reason = req.body?.reason;

    const result = await processApprovalDecision(req.params.id, "APPROVE", req.user!, reason, ip, userAgent);

    res.status(200).json({
      success: true,
      message: "Approval decision recorded",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Reject step
approvalsRouter.post("/approval-assignments/:id/reject", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = ApprovalRejectSchema.parse(req.body);
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString();
    const userAgent = req.headers["user-agent"];

    const result = await processApprovalDecision(req.params.id, "REJECT", req.user!, input.reason, ip, userAgent);

    res.status(200).json({
      success: true,
      message: "Memo rejected successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Request Revision step
approvalsRouter.post("/approval-assignments/:id/request-revision", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = ApprovalRevisionSchema.parse(req.body);
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString();
    const userAgent = req.headers["user-agent"];

    const result = await processApprovalDecision(req.params.id, "REQUEST_REVISION", req.user!, input.reason, ip, userAgent);

    res.status(200).json({
      success: true,
      message: "Revision requested successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});
