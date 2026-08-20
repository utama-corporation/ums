import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { listRoles, listPermissions, createRole, updateRolePermissions } from "../services/rbacService.js";
import { RoleCreateSchema } from "@ums/contracts";
import { z } from "zod";

export const rbacRouter: Router = Router();

rbacRouter.get("/roles", authenticate, requirePermission("master.user.manage"), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await listRoles();
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    next(error);
  }
});

rbacRouter.post("/roles", authenticate, requirePermission("master.user.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = RoleCreateSchema.parse(req.body);
    const role = await createRole(input, req.user?.id);
    res.status(201).json({ success: true, message: "Role created successfully", data: role });
  } catch (error) {
    next(error);
  }
});

rbacRouter.patch("/roles/:id/permissions", authenticate, requirePermission("master.user.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ permissionCodes: z.array(z.string()) });
    const { permissionCodes } = schema.parse(req.body);
    await updateRolePermissions(req.params.id, permissionCodes, req.user?.id);
    res.status(200).json({ success: true, message: "Role permissions updated successfully" });
  } catch (error) {
    next(error);
  }
});

rbacRouter.get("/permissions", authenticate, requirePermission("master.user.manage"), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = await listPermissions();
    res.status(200).json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});
