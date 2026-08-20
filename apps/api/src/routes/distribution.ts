import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { distributeMemo, recordReadReceipt, getExternalMemoByToken } from "../services/distributionService.js";
import { PaginationQuerySchema } from "@ums/contracts";
import { prisma } from "@ums/db";

export const distributionRouter: Router = Router();

// Distribute Memo
distributionRouter.post("/memos/:id/distribute", authenticate, requirePermission("memo.publish"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await distributeMemo(req.params.id, req.user!);
    res.status(200).json({
      success: true,
      message: "Memo distributed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Internal Inbox
distributionRouter.get("/memos/inbox", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = PaginationQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where = {
      recipients: {
        some: {
          OR: [
            { partyId: req.user!.id },
            { partyId: req.user!.departmentId },
          ],
        },
      },
      status: { in: ["OUTBOX", "PUBLISHED", "ARCHIVED"] },
      deletedAt: null,
    };

    const [total, memos] = await Promise.all([
      prisma.memo.count({ where }),
      prisma.memo.findMany({
        where,
        skip,
        take: query.limit,
        include: {
          category: true,
          memoType: true,
          senders: true,
          distributions: {
            include: {
              recipients: {
                where: { recipientUserId: req.user!.id },
                include: { readReceipts: { where: { userId: req.user!.id } } },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const formattedMemos = memos.map((m) => {
      const readReceipt = m.distributions[0]?.recipients[0]?.readReceipts[0];
      return {
        ...m,
        isRead: !!readReceipt,
        firstReadAt: readReceipt?.firstReadAt || null,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedMemos,
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

// Internal Outbox
distributionRouter.get("/memos/outbox", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = PaginationQuerySchema.parse(req.query);
    const skip = (query.page - 1) * query.limit;

    const where = {
      authorId: req.user!.id,
      status: { in: ["OUTBOX", "PUBLISHED", "ARCHIVED"] },
      deletedAt: null,
    };

    const [total, memos] = await Promise.all([
      prisma.memo.count({ where }),
      prisma.memo.findMany({
        where,
        skip,
        take: query.limit,
        include: {
          category: true,
          memoType: true,
          recipients: true,
          distributions: {
            include: {
              recipients: {
                include: { readReceipts: true },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const formattedMemos = memos.map((m) => {
      const distRecipients = m.distributions[0]?.recipients || [];
      const totalRecipients = distRecipients.length;
      const readCount = distRecipients.filter((r) => r.readReceipts.length > 0).length;

      return {
        ...m,
        readStats: {
          totalRecipients,
          readCount,
          unreadCount: totalRecipients - readCount,
          readPercentage: totalRecipients > 0 ? Math.round((readCount / totalRecipients) * 100) : 0,
        },
      };
    });

    res.status(200).json({
      success: true,
      data: formattedMemos,
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

// Read Receipt
distributionRouter.post("/memos/:id/read-receipt", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receipt = await recordReadReceipt(req.params.id, req.user!.id);
    res.status(200).json({
      success: true,
      message: "Read receipt recorded",
      data: receipt,
    });
  } catch (error) {
    next(error);
  }
});

// Public External Memo Access
distributionRouter.get("/external/memos/access/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString();
    const userAgent = req.headers["user-agent"];
    const memoData = await getExternalMemoByToken(req.params.token, ip, userAgent);

    res.status(200).json({
      success: true,
      data: memoData,
    });
  } catch (error) {
    next(error);
  }
});
