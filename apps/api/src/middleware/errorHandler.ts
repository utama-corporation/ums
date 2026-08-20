import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";
import { logger } from "../logger.js";
import { ZodError } from "zod";

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const requestId = req.headers["x-request-id"] as string;

  if (err instanceof AppError) {
    logger.warn({ err, requestId }, `AppError [${err.code}]: ${err.message}`);
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
  }

  if (err instanceof ZodError) {
    logger.warn({ err, requestId }, "Validation Error");
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input parameters",
        details: err.errors,
        requestId,
      },
    });
  }

  logger.error({ err, requestId }, "Unhandled Internal Server Error");
  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      requestId,
    },
  });
}
