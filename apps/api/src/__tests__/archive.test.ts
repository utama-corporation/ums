import { describe, it, expect, vi, beforeEach } from "vitest";
import { archiveMemo, restoreMemo, deleteDraft } from "../services/archiveService.js";
import { prisma } from "@ums/db";
import { UserProfile } from "@ums/contracts";

vi.mock("@ums/db", () => {
  const mockPrisma = {
    memo: { findUnique: vi.fn(), update: vi.fn() },
    memoStatusHistory: { create: vi.fn(), findFirst: vi.fn() },
    auditEvent: { create: vi.fn() },
  };
  return {
    prisma: {
      ...mockPrisma,
      $transaction: vi.fn((cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma)),
    },
  };
});

const adminUser: UserProfile = {
  id: "admin-1",
  email: "admin@utama.co.id",
  fullName: "Admin",
  employeeId: null,
  departmentId: null,
  departmentName: null,
  position: null,
  roles: ["SUPER_ADMIN"],
  permissions: ["memo.archive", "memo.delete"],
  isActive: true,
};

describe("Archive Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should archive a PUBLISHED memo", async () => {
    (prisma.memo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "memo-1",
      status: "PUBLISHED",
      authorId: "author-1",
      deletedAt: null,
      memoNumber: "001/MEMO/2026",
    });
    (prisma.memo.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "memo-1", status: "ARCHIVED" });

    const result = await archiveMemo("memo-1", adminUser);
    expect(result.status).toBe("ARCHIVED");
    expect(prisma.memoStatusHistory.create).toHaveBeenCalled();
  });

  it("should reject archiving a DRAFT memo", async () => {
    (prisma.memo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "memo-1",
      status: "DRAFT",
      authorId: "author-1",
      deletedAt: null,
    });

    await expect(archiveMemo("memo-1", adminUser)).rejects.toThrow("Cannot archive memo with status DRAFT");
  });

  it("should restore an ARCHIVED memo back to its prior status", async () => {
    (prisma.memo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "memo-1",
      status: "ARCHIVED",
      authorId: "author-1",
      deletedAt: null,
      memoNumber: "001/MEMO/2026",
    });
    (prisma.memoStatusHistory.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      fromStatus: "OUTBOX",
      toStatus: "ARCHIVED",
    });
    (prisma.memo.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "memo-1", status: "OUTBOX" });

    const result = await restoreMemo("memo-1", adminUser);
    expect(result.status).toBe("OUTBOX");
  });

  it("should reject restoring a memo that is not ARCHIVED", async () => {
    (prisma.memo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "memo-1",
      status: "PUBLISHED",
      authorId: "author-1",
      deletedAt: null,
    });

    await expect(restoreMemo("memo-1", adminUser)).rejects.toThrow("Only ARCHIVED memos can be restored");
  });

  it("should soft-delete a DRAFT owned by the requesting author", async () => {
    (prisma.memo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "memo-1",
      status: "DRAFT",
      authorId: "admin-1",
      deletedAt: null,
    });
    (prisma.memo.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "memo-1", deletedAt: new Date() });

    await deleteDraft("memo-1", adminUser);
    expect(prisma.memo.update).toHaveBeenCalledWith({
      where: { id: "memo-1" },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it("should reject deleting a memo that already left DRAFT/REVISION", async () => {
    (prisma.memo.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "memo-1",
      status: "WAITING_APPROVAL",
      authorId: "admin-1",
      deletedAt: null,
    });

    await expect(deleteDraft("memo-1", adminUser)).rejects.toThrow("Only DRAFT or REVISION memos can be deleted");
  });
});
