import { describe, it, expect, vi, beforeEach } from "vitest";
import { getReport } from "../services/reportService.js";
import { prisma } from "@ums/db";
import { UserProfile } from "@ums/contracts";

vi.mock("@ums/db", () => ({
  prisma: {
    memo: { groupBy: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    approvalAssignment: { groupBy: vi.fn() },
    task: { groupBy: vi.fn(), findMany: vi.fn() },
    category: { findMany: vi.fn() },
    auditEvent: { count: vi.fn(), findMany: vi.fn() },
  },
}));

const staffUser: UserProfile = {
  id: "user-1",
  email: "staff@utama.co.id",
  fullName: "Staff",
  employeeId: null,
  departmentId: "dept-1",
  departmentName: "HR",
  position: null,
  roles: ["STAFF"],
  permissions: ["report.view"],
  isActive: true,
};

const auditorUser: UserProfile = { ...staffUser, id: "auditor-1", roles: ["AUDITOR"], permissions: ["report.view", "audit.view"] };

describe("Report Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should deny user-activity report to a user without audit.view permission", async () => {
    await expect(getReport("user-activity", staffUser, { page: 1, limit: 20 })).rejects.toThrow("audit.view");
    expect(prisma.auditEvent.findMany).not.toHaveBeenCalled();
  });

  it("should allow user-activity report to a user with audit.view permission", async () => {
    (prisma.auditEvent.count as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    (prisma.auditEvent.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getReport("user-activity", auditorUser, { page: 1, limit: 20 });
    expect(result).toMatchObject({ total: 2, page: 1, limit: 20 });
  });

  it("should scope the status report to the caller's own memos when not privileged", async () => {
    (prisma.memo.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([{ status: "DRAFT", _count: { _all: 3 } }]);

    const result = await getReport("status", staffUser, { page: 1, limit: 20 });
    expect(result).toEqual({ DRAFT: 3 });

    const callArgs = (prisma.memo.groupBy as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.where.OR).toBeDefined();
  });
});
