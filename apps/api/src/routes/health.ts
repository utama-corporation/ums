import { Router, Request, Response } from "express";
import { prisma } from "@ums/db";

export const healthRouter: Router = Router();

healthRouter.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "pass",
    service: "utama-memo-system-api",
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/ready", async (_req: Request, res: Response) => {
  try {
    // Ping DB
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "ready",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "unready",
      database: "disconnected",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  }
});
