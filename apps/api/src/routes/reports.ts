import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { getReport } from "../services/reportService.js";
import { ReportQuerySchema, ReportTypeSchema } from "@ums/contracts";
import { BadRequestError } from "../errors/AppError.js";

export const reportsRouter: Router = Router();

reportsRouter.get("/reports/:type", authenticate, requirePermission("report.view"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const typeResult = ReportTypeSchema.safeParse(req.params.type);
    if (!typeResult.success) {
      throw new BadRequestError(`Unknown report type: ${req.params.type}`);
    }
    const query = ReportQuerySchema.parse(req.query);
    const data = await getReport(typeResult.data, req.user!, query);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
