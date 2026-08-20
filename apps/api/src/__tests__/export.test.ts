import { describe, it, expect, vi, beforeEach } from "vitest";
import { getExportJob, getExportDownloadUrl } from "../services/exportService.js";
import { prisma } from "@ums/db";
import { UserProfile } from "@ums/contracts";

vi.mock("@ums/db", () => ({
  prisma: {
    exportJob: { findUnique: vi.fn(), create: vi.fn() },
    domainOutboxEvent: { create: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
}));

vi.mock("../services/storageService.js", () => ({
  s3Client: {},
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://signed.example/export.csv"),
}));

const owner: UserProfile = {
  id: "user-1",
  email: "staff@utama.co.id",
  fullName: "Staff",
  employeeId: null,
  departmentId: null,
  departmentName: null,
  position: null,
  roles: ["STAFF"],
  permissions: ["report.export"],
  isActive: true,
};

const stranger: UserProfile = { ...owner, id: "user-2" };

describe("Export Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not expose another user's export job (404 instead of 403 to avoid existence leakage)", async () => {
    (prisma.exportJob.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-1",
      userId: owner.id,
      status: "COMPLETED",
    });

    await expect(getExportJob("job-1", stranger)).rejects.toThrow("Export job not found");
  });

  it("should reject downloading a job that has not completed yet", async () => {
    (prisma.exportJob.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-1",
      userId: owner.id,
      status: "PROCESSING",
      fileObjectKey: null,
    });

    await expect(getExportDownloadUrl("job-1", owner)).rejects.toThrow("Export job is not ready for download");
  });

  it("should reject downloading a job whose link has expired", async () => {
    (prisma.exportJob.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-1",
      userId: owner.id,
      status: "COMPLETED",
      fileObjectKey: "exports/user-1/status-abc.csv",
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(getExportDownloadUrl("job-1", owner)).rejects.toThrow("Export download link has expired");
  });

  it("should return a signed URL for a completed, unexpired job", async () => {
    (prisma.exportJob.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "job-1",
      userId: owner.id,
      status: "COMPLETED",
      fileObjectKey: "exports/user-1/status-abc.csv",
      expiresAt: new Date(Date.now() + 1000 * 3600),
      exportType: "CSV",
      reportType: "status",
    });

    const result = await getExportDownloadUrl("job-1", owner);
    expect(result.downloadUrl).toBe("https://signed.example/export.csv");
  });
});
