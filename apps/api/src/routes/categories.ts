import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { prisma } from "@ums/db";
import { CategorySchema, CategoryUpdateSchema } from "@ums/contracts";
import { logAuditEvent } from "../services/auditService.js";
import { NotFoundError } from "../errors/AppError.js";

export const categoriesRouter: Router = Router();

categoriesRouter.get("/", authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

categoriesRouter.post("/", authenticate, requirePermission("master.category.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CategorySchema.parse(req.body);
    const category = await prisma.category.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description || null,
      },
    });

    await logAuditEvent({
      actorId: req.user?.id,
      action: "CATEGORY_CREATED",
      module: "master.category",
      resourceType: "Category",
      resourceId: category.id,
      afterData: category,
    });

    res.status(201).json({ success: true, message: "Category created successfully", data: category });
  } catch (error) {
    next(error);
  }
});

categoriesRouter.patch("/:id", authenticate, requirePermission("master.category.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CategoryUpdateSchema.parse(req.body);
    const before = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!before) throw new NotFoundError("Category not found");

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: input,
    });

    await logAuditEvent({
      actorId: req.user?.id,
      action: "CATEGORY_UPDATED",
      module: "master.category",
      resourceType: "Category",
      resourceId: category.id,
      beforeData: before,
      afterData: category,
    });

    res.status(200).json({ success: true, message: "Category updated successfully", data: category });
  } catch (error) {
    next(error);
  }
});
