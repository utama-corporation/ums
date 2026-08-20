import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { createExportJob, getExportJob, getExportDownloadUrl } from "../services/exportService.js";
import { ExportCreateSchema } from "@ums/contracts";

export const exportsRouter: Router = Router();

exportsRouter.post("/exports", authenticate, requirePermission("report.export"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = ExportCreateSchema.parse(req.body);
    const job = await createExportJob(req.user!, input);
    res.status(201).json({ success: true, message: "Export job queued", data: job });
  } catch (error) {
    next(error);
  }
});

exportsRouter.get("/exports/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await getExportJob(req.params.id, req.user!);
    res.status(200).json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
});

exportsRouter.get("/exports/:id/download", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getExportDownloadUrl(req.params.id, req.user!);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});
