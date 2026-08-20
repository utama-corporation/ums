import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { getCompanyProfile, updateCompanyProfile, getSecurityPolicy, updateSecurityPolicy } from "../services/settingsService.js";
import { CompanyProfileUpdateSchema, SecurityPolicySchema } from "@ums/contracts";

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
