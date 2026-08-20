import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { createDepartment, updateDepartment, listDepartments } from "../services/departmentService.js";
import { DepartmentCreateSchema, DepartmentUpdateSchema } from "@ums/contracts";

export const departmentsRouter: Router = Router();

departmentsRouter.get("/", authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const departments = await listDepartments();
    res.status(200).json({
      success: true,
      data: departments,
    });
  } catch (error) {
    next(error);
  }
});

departmentsRouter.post("/", authenticate, requirePermission("master.department.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = DepartmentCreateSchema.parse(req.body);
    const dept = await createDepartment(input, req.user?.id);
    res.status(201).json({
      success: true,
      message: "Department created successfully",
      data: dept,
    });
  } catch (error) {
    next(error);
  }
});

departmentsRouter.patch("/:id", authenticate, requirePermission("master.department.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = DepartmentUpdateSchema.parse(req.body);
    const dept = await updateDepartment(req.params.id, input, req.user?.id);
    res.status(200).json({
      success: true,
      message: "Department updated successfully",
      data: dept,
    });
  } catch (error) {
    next(error);
  }
});
