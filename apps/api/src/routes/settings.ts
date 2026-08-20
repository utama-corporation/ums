import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import {
  getCompanyProfile,
  updateCompanyProfile,
  getSecurityPolicy,
  updateSecurityPolicy,
  getSmtpConfig,
  updateSmtpConfig,
} from "../services/settingsService.js";
import { prisma } from "@ums/db";
import { CompanyProfileUpdateSchema, SecurityPolicySchema, SmtpConfigSchema } from "@ums/contracts";
import { UnauthorizedError } from "../errors/AppError.js";

export const settingsRouter: Router = Router();

settingsRouter.get("/settings/company-profile", authenticate, requirePermission("settings.manage"), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await getCompanyProfile();
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/settings/company-profile", authenticate, requirePermission("settings.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CompanyProfileUpdateSchema.parse(req.body);
    const profile = await updateCompanyProfile(input, req.user?.id);
    res.status(200).json({ success: true, message: "Company profile updated successfully", data: profile });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/settings/security", authenticate, requirePermission("settings.manage"), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const policy = await getSecurityPolicy();
    res.status(200).json({ success: true, data: policy });
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/settings/security", authenticate, requirePermission("settings.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = SecurityPolicySchema.parse(req.body);
    const policy = await updateSecurityPolicy(input, req.user?.id);
    res.status(200).json({
      success: true,
      message: "Security policy updated successfully. Applies to sessions created after this change — existing sessions keep their original expiry.",
      data: policy,
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/settings/smtp", authenticate, requirePermission("settings.manage"), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await getSmtpConfig();
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/settings/smtp", authenticate, requirePermission("settings.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = SmtpConfigSchema.parse(req.body);
    const config = await updateSmtpConfig(input, req.user?.id);
    res.status(200).json({
      success: true,
      message: "SMTP config updated successfully. Password is managed via the server's SMTP_PASS environment variable, not through this form.",
      data: config,
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/settings/smtp/test", authenticate, requirePermission("settings.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new UnauthorizedError("Authentication required");
    await prisma.domainOutboxEvent.create({
      data: {
        eventType: "SMTP_TEST_EMAIL_REQUESTED",
        aggregateType: "SystemSetting",
        aggregateId: "smtp",
        payloadJson: JSON.stringify({ to: req.user.email }),
      },
    });
    res.status(202).json({ success: true, message: `Test email queued, check ${req.user.email} in a few seconds.` });
  } catch (error) {
    next(error);
  }
});
