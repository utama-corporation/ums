import { Router, Request, Response, NextFunction } from "express";
import { authenticate, requirePermission } from "../middleware/authMiddleware.js";
import { createWorkflowDefinition, createNewWorkflowVersion, activateWorkflowVersion, listWorkflows } from "../services/workflowService.js";
import { WorkflowDefinitionSchema, WorkflowStepSchema } from "@ums/contracts";
import { z } from "zod";

export const workflowsRouter: Router = Router();

workflowsRouter.get("/", authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const workflows = await listWorkflows();
    res.status(200).json({ success: true, data: workflows });
  } catch (error) {
    next(error);
  }
});

workflowsRouter.post("/", authenticate, requirePermission("master.workflow.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = WorkflowDefinitionSchema.parse(req.body);
    const workflow = await createWorkflowDefinition(input, req.user?.id);
    res.status(201).json({ success: true, message: "Workflow created successfully", data: workflow });
  } catch (error) {
    next(error);
  }
});

workflowsRouter.post("/:id/versions", authenticate, requirePermission("master.workflow.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ steps: z.array(WorkflowStepSchema) });
    const { steps } = schema.parse(req.body);
    const version = await createNewWorkflowVersion(req.params.id, steps, req.user?.id);
    res.status(201).json({ success: true, message: "New workflow draft version created", data: version });
  } catch (error) {
    next(error);
  }
});

workflowsRouter.post("/versions/:versionId/activate", authenticate, requirePermission("master.workflow.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activated = await activateWorkflowVersion(req.params.versionId, req.user?.id);
    res.status(200).json({ success: true, message: "Workflow version activated", data: activated });
  } catch (error) {
    next(error);
  }
});
