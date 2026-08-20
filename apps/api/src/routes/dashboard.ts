import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { getDashboardStats } from "../services/dashboardService.js";

export const dashboardRouter: Router = Router();

dashboardRouter.get("/dashboard", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await getDashboardStats(req.user!);
    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});
