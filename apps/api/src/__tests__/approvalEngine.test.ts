import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveApproversForStep } from "../services/approvalEngineService.js";
import { prisma } from "@ums/db";

vi.mock("@ums/db", () => ({
  prisma: {
    userRole: {
      findMany: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
  },
}));

describe("Approval Engine Approver Resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should resolve USER strategy directly", async () => {
    const approvers = await resolveApproversForStep({ strategy: "USER", targetId: "user-10" }, "author-1");
    expect(approvers).toEqual(["user-10"]);
  });

  it("should resolve ROLE strategy by fetching users with assigned role", async () => {
    (prisma.userRole.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);

    const approvers = await resolveApproversForStep({ strategy: "ROLE", targetId: "role-admin" }, "author-1");
    expect(approvers).toEqual(["user-1", "user-2"]);
  });

  it("should resolve DEPARTMENT_HEAD strategy by fetching headUserId from department", async () => {
    (prisma.department.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "dept-hr",
      headUserId: "head-hr-user",
    });

    const approvers = await resolveApproversForStep({ strategy: "DEPARTMENT_HEAD" }, "author-1", "dept-hr");
    expect(approvers).toEqual(["head-hr-user"]);
  });
});
