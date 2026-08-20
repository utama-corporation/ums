import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchMemos } from "../services/searchService.js";
import { prisma } from "@ums/db";
import { UserProfile } from "@ums/contracts";

vi.mock("@ums/db", () => ({
  prisma: {
    memo: { count: vi.fn(), findMany: vi.fn() },
    $queryRaw: vi.fn(),
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
  permissions: ["memo.view"],
  isActive: true,
};

const adminUser: UserProfile = { ...staffUser, id: "admin-1", roles: ["SUPER_ADMIN"], permissions: ["memo.view"] };

const confidentialMemoNotAddressedToUser = {
  id: "memo-secret",
  authorId: "someone-else",
  classification: "HIGHLY_CONFIDENTIAL",
  recipients: [{ partyId: "another-user" }],
};

describe("Search Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should exclude confidential memos the caller has no access to, even if returned by the query", async () => {
    (prisma.memo.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (prisma.memo.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([confidentialMemoNotAddressedToUser]);

    const result = await searchMemos(staffUser, { page: 1, limit: 20 });
    expect(result.items).toHaveLength(0);
  });

  it("should allow admin/auditor scope to see confidential memos", async () => {
    (prisma.memo.count as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (prisma.memo.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([confidentialMemoNotAddressedToUser]);

    const result = await searchMemos(adminUser, { page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
  });

  it("should short-circuit with zero results when full-text search finds no matching IDs", async () => {
    (prisma.$queryRaw as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await searchMemos(staffUser, { q: "nonexistent term", page: 1, limit: 20 });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
    expect(prisma.memo.findMany).not.toHaveBeenCalled();
  });
});
