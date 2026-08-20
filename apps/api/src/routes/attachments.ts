import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/authMiddleware.js";
import { completeAttachmentUpload, getAttachmentDownloadUrl, removeAttachment } from "../services/storageService.js";
import { AttachmentCompleteSchema } from "@ums/contracts";

export const attachmentsRouter: Router = Router();

attachmentsRouter.post("/:id/complete", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = AttachmentCompleteSchema.parse(req.body);
    const completed = await completeAttachmentUpload(req.params.id, input.checksumSha256, req.user!.id);
    res.status(200).json({ success: true, message: "Attachment marked ready", data: completed });
  } catch (error) {
    next(error);
  }
});

attachmentsRouter.get("/:id/download", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getAttachmentDownloadUrl(req.params.id, req.user!.id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

attachmentsRouter.delete("/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await removeAttachment(req.params.id, req.user!.id);
    res.status(200).json({ success: true, message: "Attachment deleted successfully" });
  } catch (error) {
    next(error);
  }
});
