import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { searchEmployees, syncEmployees } from "../services/employeeSyncService.js";

export const employeesRouter: Router = Router();

const SearchQuerySchema = z.object({
  q: z.string().default(""),
});

employeesRouter.get("/employees/search", authenticate, requirePermission("master.user.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { q } = SearchQuerySchema.parse(req.query);
    const results = await searchEmployees(q);
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

employeesRouter.post("/employees/sync", authenticate, requirePermission("master.user.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await syncEmployees(req.user?.id);
    res.status(200).json({
      success: true,
      message: `Sinkronisasi selesai: ${summary.totalEmployeesFetched} karyawan ditemukan, ${summary.usersDisabled.length} user dinonaktifkan.`,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});
