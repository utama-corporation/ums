import { describe, it, expect } from "vitest";
import { validateWorkflowSteps } from "../services/workflowService.js";

describe("Workflow Step Validator", () => {
  it("should fail validation if steps are empty", () => {
    const res = validateWorkflowSteps([]);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("Workflow must contain at least one step");
  });

  it("should fail validation if step orders are non-sequential (e.g. 1, 3)", () => {
    const res = validateWorkflowSteps([
      {
        stepOrder: 1,
        name: "Initial Review",
        mode: "SEQUENTIAL",
        parallelPolicy: "ALL",
        requireSignature: false,
        approverRules: [{ strategy: "DEPARTMENT_HEAD" }],
        conditions: [],
      },
      {
        stepOrder: 3,
        name: "Final Approval",
        mode: "SEQUENTIAL",
        parallelPolicy: "ALL",
        requireSignature: false,
        approverRules: [{ strategy: "ROLE", targetId: "00000000-0000-0000-0000-000000000001" }],
        conditions: [],
      },
    ]);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("Step orders must be sequential");
  });

  it("should fail validation if USER strategy missing targetId", () => {
    const res = validateWorkflowSteps([
      {
        stepOrder: 1,
        name: "Step 1",
        mode: "SEQUENTIAL",
        parallelPolicy: "ALL",
        requireSignature: false,
        approverRules: [{ strategy: "USER" }],
        conditions: [],
      },
    ]);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("has strategy 'USER' but no target ID assigned");
  });

  it("should pass validation for valid sequential steps", () => {
    const res = validateWorkflowSteps([
      {
        stepOrder: 1,
        name: "Step 1",
        mode: "SEQUENTIAL",
        parallelPolicy: "ALL",
        requireSignature: false,
        approverRules: [{ strategy: "DEPARTMENT_HEAD" }],
        conditions: [],
      },
      {
        stepOrder: 2,
        name: "Step 2",
        mode: "PARALLEL",
        parallelPolicy: "ALL",
        requireSignature: true,
        approverRules: [{ strategy: "ROLE", targetId: "00000000-0000-0000-0000-000000000002" }],
        conditions: [{ field: "priority", operator: "EQUALS", value: "HIGH" }],
      },
    ]);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });
});
