import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkDepartmentParentCycle } from "../services/departmentService.js";
import { prisma } from "@ums/db";

vi.mock("@ums/db", () => ({
  prisma: {
    department: {
      findUnique: vi.fn(),
    },
  },
}));

describe("Department Cycle Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect self-referential parent cycle", async () => {
    const isCycle = await checkDepartmentParentCycle("dept-1", "dept-1");
    expect(isCycle).toBe(true);
  });

  it("should detect 2-level parent cycle (A -> B -> A)", async () => {
    (prisma.department.findUnique as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "dept-b") return { parentId: "dept-a" };
      return null;
    });

    const isCycle = await checkDepartmentParentCycle("dept-a", "dept-b");
    expect(isCycle).toBe(true);
  });

  it("should return false for valid hierarchy (A -> B -> C)", async () => {
    (prisma.department.findUnique as ReturnType<typeof vi.fn>).mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "dept-c") return { parentId: "dept-b" };
      if (where.id === "dept-b") return { parentId: null };
      return null;
    });

    const isCycle = await checkDepartmentParentCycle("dept-a", "dept-c");
    expect(isCycle).toBe(false);
  });
});
