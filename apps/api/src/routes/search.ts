import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { searchMemos } from "../services/searchService.js";
import { SearchQuerySchema } from "@ums/contracts";

export const searchRouter: Router = Router();

searchRouter.get("/search", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = SearchQuerySchema.parse(req.query);
    const result = await searchMemos(req.user!, query);
    res.status(200).json({
      success: true,
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    next(error);
  }
});
