import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { createNumberingRule, listNumberingRules, formatMemoNumber } from "../services/numberingService.js";
import { MemoNumberingRuleSchema, MemoNumberingRuleUpdateSchema } from "@ums/contracts";
import { z } from "zod";
import { prisma } from "@ums/db";
import { logAuditEvent } from "../services/auditService.js";
import { NotFoundError } from "../errors/AppError.js";

export const numberingRouter: Router = Router();

numberingRouter.get("/", authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await listNumberingRules();
    res.status(200).json({ success: true, data: rules });
  } catch (error) {
    next(error);
  }
});

numberingRouter.post("/", authenticate, requirePermission("master.category.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = MemoNumberingRuleSchema.parse(req.body);
    const rule = await createNumberingRule(input, req.user?.id);
    res.status(201).json({ success: true, message: "Numbering rule created successfully", data: rule });
  } catch (error) {
    next(error);
  }
});

numberingRouter.patch("/:id", authenticate, requirePermission("master.category.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = MemoNumberingRuleUpdateSchema.parse(req.body);
    const before = await prisma.memoNumberingRule.findUnique({ where: { id: req.params.id } });
    if (!before) throw new NotFoundError("Numbering rule not found");

    const rule = await prisma.memoNumberingRule.update({
      where: { id: req.params.id },
      data: input,
    });

    await logAuditEvent({
      actorId: req.user?.id,
      action: "NUMBERING_RULE_UPDATED",
      module: "master.category",
      resourceType: "MemoNumberingRule",
      resourceId: rule.id,
      beforeData: before,
      afterData: rule,
    });

    res.status(200).json({ success: true, message: "Numbering rule updated successfully", data: rule });
  } catch (error) {
    next(error);
  }
});

numberingRouter.post("/preview", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const previewSchema = z.object({
      formatPattern: z.string(),
      paddingDigits: z.number().default(4),
      deptCode: z.string().default("HR"),
      typeCode: z.string().default("MEMO"),
      sequence: z.number().default(1),
    });
    const input = previewSchema.parse(req.body);
    const preview = formatMemoNumber(input.formatPattern, input.sequence, input.paddingDigits, input.deptCode, input.typeCode);

    res.status(200).json({ success: true, data: { preview } });
  } catch (error) {
    next(error);
  }
});
