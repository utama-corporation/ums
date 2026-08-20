import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { createUser, updateUser, resetUserPassword, listUsers } from "../services/userService.js";
import { UserCreateSchema, UserUpdateSchema, PasswordResetSchema, PaginationQuerySchema } from "@ums/contracts";

export const usersRouter: Router = Router();

usersRouter.get("/", authenticate, requirePermission("master.user.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = PaginationQuerySchema.parse(req.query);
    const { total, users } = await listUsers(query.page, query.limit, query.search);

    res.status(200).json({
      success: true,
      data: users,
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

usersRouter.post("/", authenticate, requirePermission("master.user.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = UserCreateSchema.parse(req.body);
    const user = await createUser(input, req.user?.id);
    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.patch("/:id", authenticate, requirePermission("master.user.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = UserUpdateSchema.parse(req.body);
    const user = await updateUser(req.params.id, input, req.user?.id);
    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/:id/reset-password", authenticate, requirePermission("master.user.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = PasswordResetSchema.parse(req.body);
    await resetUserPassword(req.params.id, input.newPassword, req.user?.id);
    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    next(error);
  }
});
