import { describe, it, expect } from "vitest";
import { calculateMemoCapabilities } from "../services/memoDraftService.js";
import { UserProfile } from "@ums/contracts";

describe("Memo Draft Capabilities Calculation", () => {
  const userStaff: UserProfile = {
    id: "user-1",
    email: "staff@utama.co.id",
    fullName: "Staff User",
    employeeId: null,
    departmentId: "dept-1",
    departmentName: "HR",
    position: "Staff",
    roles: ["STAFF"],
    permissions: ["memo.create", "memo.view", "memo.submit"],
    isActive: true,
  };

  it("should allow editing, deleting, and submitting a DRAFT memo by its author", () => {
    const memo = {
      id: "memo-1",
      authorId: "user-1",
      status: "DRAFT",
    };

    const caps = calculateMemoCapabilities(memo, userStaff);
    expect(caps.canEdit).toBe(true);
    expect(caps.canDelete).toBe(true);
    expect(caps.canSubmit).toBe(true);
    expect(caps.canPublish).toBe(false);
  });

  it("should disallow editing a PUBLISHED memo", () => {
    const memo = {
      id: "memo-1",
      authorId: "user-1",
      status: "PUBLISHED",
    };

    const caps = calculateMemoCapabilities(memo, userStaff);
    expect(caps.canEdit).toBe(false);
    expect(caps.canDelete).toBe(false);
  });
});
