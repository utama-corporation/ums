import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { publishMemo, getCanonicalPdfDownloadUrl, verifyDocumentToken, listSignatureProfiles, setSignatureProfileActive } from "../services/publicationService.js";
import { z } from "zod";

export const publicationRouter: Router = Router();

// Master Digital Signature (read-only listing)
publicationRouter.get("/signatures", authenticate, requirePermission("master.signature.manage"), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const profiles = await listSignatureProfiles();
    res.status(200).json({ success: true, data: profiles });
  } catch (error) {
    next(error);
  }
});

// Enable/disable a user's signing capability
publicationRouter.patch("/signatures/:id", authenticate, requirePermission("master.signature.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const profile = await setSignatureProfileActive(req.params.id, isActive, req.user?.id);
    res.status(200).json({ success: true, message: "Signature profile updated successfully", data: profile });
  } catch (error) {
    next(error);
  }
});

// Publish Memo
publicationRouter.post("/memos/:id/publish", authenticate, requirePermission("memo.publish"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ip = req.ip || req.headers["x-forwarded-for"]?.toString();
    const result = await publishMemo(req.params.id, req.user!, ip);
    res.status(200).json({
      success: true,
      message: "Memo published successfully with digital signature",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Download Canonical PDF
publicationRouter.get("/memos/:id/canonical-pdf", authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await getCanonicalPdfDownloadUrl(req.params.id);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Public Document Verification Portal
publicationRouter.get("/verify/:token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const verification = await verifyDocumentToken(req.params.token);
    res.status(200).json({
      success: true,
      data: verification,
    });
  } catch (error) {
    next(error);
  }
});
