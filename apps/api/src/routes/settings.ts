import { Router, Request, Response, NextFunction } from "express";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import {
  getCompanyProfile,
  updateCompanyProfile,
  getSecurityPolicy,
  updateSecurityPolicy,
  getSmtpConfig,
  updateSmtpConfig,
  getS3Config,
  updateS3Config,
} from "../services/settingsService.js";
import { getS3Client, getS3Bucket } from "../services/storageService.js";
import { prisma } from "@ums/db";
import { CompanyProfileUpdateSchema, SecurityPolicySchema, SmtpConfigSchema, S3ConfigSchema } from "@ums/contracts";
import { UnauthorizedError, BadRequestError } from "../errors/AppError.js";

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

settingsRouter.get("/settings/storage", authenticate, requirePermission("settings.manage"), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await getS3Config();
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

settingsRouter.patch("/settings/storage", authenticate, requirePermission("settings.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = S3ConfigSchema.parse(req.body);
    const config = await updateS3Config(input, req.user?.id);
    res.status(200).json({ success: true, message: "Konfigurasi storage berhasil disimpan.", data: config });
  } catch (error) {
    next(error);
  }
});

settingsRouter.post("/settings/storage/test", authenticate, requirePermission("settings.manage"), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const bucket = await getS3Bucket();
    try {
      const client = await getS3Client();
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (connectionError) {
      const message = connectionError instanceof Error ? connectionError.message : "Gagal terhubung ke storage";
      throw new BadRequestError(`Gagal terhubung ke bucket "${bucket}": ${message}`);
    }
    res.status(200).json({ success: true, message: `Berhasil terhubung ke bucket "${bucket}".` });
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
