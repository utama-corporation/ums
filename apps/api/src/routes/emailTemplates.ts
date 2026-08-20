import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { listEmailTemplates, updateEmailTemplate } from "../services/emailTemplateService.js";
import { EmailTemplateUpdateSchema } from "@ums/contracts";

export const emailTemplatesRouter: Router = Router();

emailTemplatesRouter.get("/email-templates", authenticate, requirePermission("settings.manage"), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await listEmailTemplates();
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
});

emailTemplatesRouter.patch(
  "/email-templates/:notificationType",
  authenticate,
  requirePermission("settings.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = EmailTemplateUpdateSchema.parse(req.body);
      const template = await updateEmailTemplate(req.params.notificationType, input, req.user?.id);
      res.status(200).json({ success: true, message: "Email template updated successfully", data: template });
    } catch (error) {
      next(error);
    }
  }
);
