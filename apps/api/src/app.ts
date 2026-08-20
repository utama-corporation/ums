import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import { requestIdMiddleware } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { healthRouter } from "./routes/health.js";
import { authRouter, meRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { departmentsRouter } from "./routes/departments.js";
import { rbacRouter } from "./routes/rbac.js";
import { categoriesRouter } from "./routes/categories.js";
import { companiesRouter } from "./routes/companies.js";
import { employeesRouter } from "./routes/employees.js";
import { memoTypesRouter } from "./routes/memoTypes.js";
import { numberingRouter } from "./routes/numbering.js";
import { workflowsRouter } from "./routes/workflows.js";
import { memosRouter } from "./routes/memos.js";
import { attachmentsRouter } from "./routes/attachments.js";
import { approvalsRouter } from "./routes/approvals.js";
import { distributionRouter } from "./routes/distribution.js";
import { publicationRouter } from "./routes/publication.js";
import { dispositionsRouter } from "./routes/dispositions.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { settingsRouter } from "./routes/settings.js";
import { searchRouter } from "./routes/search.js";
import { reportsRouter } from "./routes/reports.js";
import { exportsRouter } from "./routes/exports.js";
import { openApiSpec } from "./openapi.js";
import { env } from "@ums/config";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.APP_URL,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(requestIdMiddleware);

  // API v1 Routes
  app.use("/api/v1", healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1", meRouter);
  app.use("/api/v1/users", usersRouter);
  app.use("/api/v1/departments", departmentsRouter);
  app.use("/api/v1", rbacRouter);
  app.use("/api/v1/categories", categoriesRouter);
  app.use("/api/v1/companies", companiesRouter);
  app.use("/api/v1", employeesRouter);
  app.use("/api/v1/memo-types", memoTypesRouter);
  app.use("/api/v1/numbering-rules", numberingRouter);
  app.use("/api/v1/workflows", workflowsRouter);
  app.use("/api/v1/memos", memosRouter);
  app.use("/api/v1/attachments", attachmentsRouter);
  app.use("/api/v1", approvalsRouter);
  app.use("/api/v1", distributionRouter);
  app.use("/api/v1", publicationRouter);
  app.use("/api/v1", dispositionsRouter);
  app.use("/api/v1", dashboardRouter);
  app.use("/api/v1", settingsRouter);
  app.use("/api/v1", searchRouter);
  app.use("/api/v1", reportsRouter);
  app.use("/api/v1", exportsRouter);

  // OpenAPI spec route
  app.get("/api/v1/openapi.json", (_req, res) => {
    res.json(openApiSpec);
  });

  // Fallback 404
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found",
      },
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
