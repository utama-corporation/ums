import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { PaginationQuerySchema } from "@ums/contracts";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notificationService.js";
import { UnauthorizedError } from "../errors/AppError.js";

export const notificationsRouter: Router = Router();

notificationsRouter.get("/notifications", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const query = PaginationQuerySchema.parse(req.query);
    const { total, notifications } = await listNotifications(req.user.id, query.page, query.limit);

    res.status(200).json({
      success: true,
      data: notifications,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.get("/notifications/unread-count", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    const unreadCount = await getUnreadCount(req.user.id);
    res.status(200).json({ success: true, data: { unreadCount } });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/notifications/:id/read", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    await markNotificationRead(req.params.id, req.user.id);
    res.status(200).json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post("/notifications/read-all", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    await markAllNotificationsRead(req.user.id);
    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
});
