import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { createDraft, updateDraft, autosaveDraft, getMemoDetail, copyDraft, calculateMemoCapabilities } from "../services/memoDraftService.js";
import { initiateAttachmentUpload } from "../services/storageService.js";
import { deleteDraft, archiveMemo, restoreMemo } from "../services/archiveService.js";
import { MemoCreateDraftSchema, MemoUpdateDraftSchema, MemoAutosaveSchema, AttachmentInitiateSchema, PaginationQuerySchema } from "@ums/contracts";
import { prisma, Prisma } from "@ums/db";

export const memosRouter: Router = Router();

// Constrains `:id` to an actual UUID so literal sibling routes registered on other
// routers (e.g. GET /memos/inbox, GET /memos/outbox) can never be shadowed by this
// catch-all — Express/path-to-regexp matches routes strictly in registration order,
// and an unconstrained `:id` would otherwise swallow any single-segment path first.
const UUID_ID = ":id([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})";

memosRouter.get("/", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = PaginationQuerySchema.parse(req.query);
    const status = req.query.status as string | undefined;
    const skip = (query.page - 1) * query.limit;

    const where: Prisma.MemoWhereInput = { deletedAt: null };

    if (status) {
      where.status = status;
    } else {
      // Non-admins only see DRAFT memos authored by themselves or received
      if (!req.user?.roles.includes("SUPER_ADMIN") && !req.user?.roles.includes("MEMO_ADMIN")) {
        where.OR = [
          { authorId: req.user?.id },
          { recipients: { some: { partyId: req.user?.id } } },
          { recipients: { some: { partyId: req.user?.departmentId } } },
        ];
      }
    }

    if (query.search) {
      where.title = { contains: query.search, mode: "insensitive" };
    }

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
          recipients: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: memos,
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

memosRouter.post("/", authenticate, requirePermission("memo.create"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = MemoCreateDraftSchema.parse(req.body);
    const memo = await createDraft(input, req.user!.id);
    res.status(201).json({ success: true, message: "Draft created successfully", data: memo });
  } catch (error) {
    next(error);
  }
});

memosRouter.get(`/${UUID_ID}`, authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await getMemoDetail(req.params.id, req.user!);
    res.status(200).json({ success: true, data: detail });
  } catch (error) {
    next(error);
  }
});

memosRouter.patch(`/${UUID_ID}`, authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = MemoUpdateDraftSchema.parse(req.body);
    const updated = await updateDraft(req.params.id, input, req.user!.id);
    res.status(200).json({ success: true, message: "Draft updated successfully", data: updated });
  } catch (error) {
    next(error);
  }
});

memosRouter.post(`/${UUID_ID}/autosave`, authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = MemoAutosaveSchema.parse(req.body);
    const result = await autosaveDraft(req.params.id, input, req.user!.id);
    res.status(200).json({ success: true, message: "Autosaved", data: result });
  } catch (error) {
    next(error);
  }
});

memosRouter.get(`/${UUID_ID}/capabilities`, authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memo = await prisma.memo.findUnique({ where: { id: req.params.id } });
    if (!memo) return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Memo not found" } });
    const capabilities = calculateMemoCapabilities(memo, req.user!);
    res.status(200).json({ success: true, data: capabilities });
  } catch (error) {
    next(error);
  }
});

memosRouter.post(`/${UUID_ID}/copy`, authenticate, requirePermission("memo.create"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const copied = await copyDraft(req.params.id, req.user!.id);
    res.status(201).json({ success: true, message: "Memo copied as new draft", data: copied });
  } catch (error) {
    next(error);
  }
});

memosRouter.delete(`/${UUID_ID}`, authenticate, requirePermission("memo.delete"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await deleteDraft(req.params.id, req.user!);
    res.status(200).json({ success: true, message: "Draft deleted successfully" });
  } catch (error) {
    next(error);
  }
});

memosRouter.post(`/${UUID_ID}/archive`, authenticate, requirePermission("memo.archive"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const archived = await archiveMemo(req.params.id, req.user!);
    res.status(200).json({ success: true, message: "Memo archived successfully", data: archived });
  } catch (error) {
    next(error);
  }
});

memosRouter.post(`/${UUID_ID}/restore`, authenticate, requirePermission("memo.archive"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restored = await restoreMemo(req.params.id, req.user!);
    res.status(200).json({ success: true, message: "Memo restored successfully", data: restored });
  } catch (error) {
    next(error);
  }
});

memosRouter.post(`/${UUID_ID}/attachments/initiate`, authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = AttachmentInitiateSchema.parse(req.body);
    const result = await initiateAttachmentUpload(req.params.id, input.fileName, input.fileSize, input.mimeType, req.user!.id);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});
