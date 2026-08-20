import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { prisma } from "@ums/db";
import { MemoTypeSchema, MemoTypeUpdateSchema } from "@ums/contracts";
import { logAuditEvent } from "../services/auditService.js";
import { NotFoundError } from "../errors/AppError.js";

export const memoTypesRouter: Router = Router();

memoTypesRouter.get("/", authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await prisma.memoType.findMany({ orderBy: { name: "asc" } });
    res.status(200).json({ success: true, data: types });
  } catch (error) {
    next(error);
  }
});

memoTypesRouter.post("/", authenticate, requirePermission("master.category.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = MemoTypeSchema.parse(req.body);
    const memoType = await prisma.memoType.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description || null,
      },
    });

    await logAuditEvent({
      actorId: req.user?.id,
      action: "MEMO_TYPE_CREATED",
      module: "master.category",
      resourceType: "MemoType",
      resourceId: memoType.id,
      afterData: memoType,
    });

    res.status(201).json({ success: true, message: "Memo type created successfully", data: memoType });
  } catch (error) {
    next(error);
  }
});

memoTypesRouter.patch("/:id", authenticate, requirePermission("master.category.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = MemoTypeUpdateSchema.parse(req.body);
    const before = await prisma.memoType.findUnique({ where: { id: req.params.id } });
    if (!before) throw new NotFoundError("Memo type not found");

    const memoType = await prisma.memoType.update({
      where: { id: req.params.id },
      data: input,
    });

    await logAuditEvent({
      actorId: req.user?.id,
      action: "MEMO_TYPE_UPDATED",
      module: "master.category",
      resourceType: "MemoType",
      resourceId: memoType.id,
      beforeData: before,
      afterData: memoType,
    });

    res.status(200).json({ success: true, message: "Memo type updated successfully", data: memoType });
  } catch (error) {
    next(error);
  }
});
