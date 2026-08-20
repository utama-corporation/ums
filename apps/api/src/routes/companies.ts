import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { prisma } from "@ums/db";
import { CompanySchema, CompanyUpdateSchema } from "@ums/contracts";
import { logAuditEvent } from "../services/auditService.js";
import { NotFoundError } from "../errors/AppError.js";

export const companiesRouter: Router = Router();

companiesRouter.get("/", authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });
    res.status(200).json({ success: true, data: companies });
  } catch (error) {
    next(error);
  }
});

companiesRouter.post("/", authenticate, requirePermission("master.company.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CompanySchema.parse(req.body);
    const company = await prisma.company.create({
      data: { code: input.code, name: input.name },
    });

    await logAuditEvent({
      actorId: req.user?.id,
      action: "COMPANY_CREATED",
      module: "master.company",
      resourceType: "Company",
      resourceId: company.id,
      afterData: company,
    });

    res.status(201).json({ success: true, message: "Company created successfully", data: company });
  } catch (error) {
    next(error);
  }
});

companiesRouter.patch("/:id", authenticate, requirePermission("master.company.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CompanyUpdateSchema.parse(req.body);
    const before = await prisma.company.findUnique({ where: { id: req.params.id } });
    if (!before) throw new NotFoundError("Company not found");

    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: input,
    });

    await logAuditEvent({
      actorId: req.user?.id,
      action: "COMPANY_UPDATED",
      module: "master.company",
      resourceType: "Company",
      resourceId: company.id,
      beforeData: before,
      afterData: company,
    });

    res.status(200).json({ success: true, message: "Company updated successfully", data: company });
  } catch (error) {
    next(error);
  }
});
