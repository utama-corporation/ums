import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { createDisposition, updateTaskProgress, verifyTask } from "../services/dispositionService.js";
import { DispositionCreateSchema, TaskProgressUpdateSchema, TaskVerifySchema } from "@ums/contracts";
import { prisma } from "@ums/db";

export const dispositionsRouter: Router = Router();

// Create Disposition
dispositionsRouter.post("/memos/:id/dispositions", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = DispositionCreateSchema.parse(req.body);
    const disposition = await createDisposition(req.params.id, input, req.user!);
    res.status(201).json({
      success: true,
      message: "Disposition created successfully",
      data: disposition,
    });
  } catch (error) {
    next(error);
  }
});

// My Assigned Tasks
dispositionsRouter.get("/tasks/assigned", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        assignees: {
          some: { userId: req.user!.id },
        },
      },
      include: {
        disposition: {
          include: {
            memo: {
              select: { id: true, title: true, memoNumber: true },
            },
          },
        },
        statusHistory: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
});

// Dispositions Issued By Me
dispositionsRouter.get("/tasks/issued", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dispositions = await prisma.memoDisposition.findMany({
      where: { issuerId: req.user!.id },
      include: {
        memo: { select: { id: true, title: true, memoNumber: true } },
        tasks: {
          include: {
            assignees: true,
            statusHistory: { orderBy: { createdAt: "desc" } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, data: dispositions });
  } catch (error) {
    next(error);
  }
});

// Update Task Progress
dispositionsRouter.patch("/tasks/:id/progress", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = TaskProgressUpdateSchema.parse(req.body);
    const updated = await updateTaskProgress(req.params.id, input, req.user!);
    res.status(200).json({
      success: true,
      message: "Task progress updated",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// Verify Task Completion
dispositionsRouter.post("/tasks/:id/verify", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = TaskVerifySchema.parse(req.body);
    const verified = await verifyTask(req.params.id, input, req.user!);
    res.status(200).json({
      success: true,
      message: "Task verification recorded",
      data: verified,
    });
  } catch (error) {
    next(error);
  }
});
