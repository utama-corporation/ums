import { describe, it, expect, vi, beforeEach } from "vitest";
import { InternalSignatureProvider, verifyDocumentToken, setSignatureProfileActive } from "../services/publicationService.js";
import { UserProfile } from "@ums/contracts";
import { prisma } from "@ums/db";

vi.mock("@ums/db", () => ({
  prisma: {
    documentVerificationToken: {
      findUnique: vi.fn(),
    },
    digitalSignatureProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
  },
}));

describe("Publication & Digital Signature Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("InternalSignatureProvider should generate signature result with 32-char hex verification token", async () => {
    const provider = new InternalSignatureProvider();
    const mockSigner: UserProfile = {
      id: "signer-1",
      email: "signer@utama.co.id",
      fullName: "Signer Name",
      employeeId: null,
      departmentId: null,
      departmentName: null,
      position: null,
      roles: ["SUPER_ADMIN"],
      permissions: ["memo.publish"],
      isActive: true,
    };

    const res = await provider.signDocument("dummy_hash_1234567890", mockSigner);
    expect(res.signatureType).toBe("INTERNAL");
    expect(res.verificationToken.length).toBe(32);
    expect(res.signedHash).toBeDefined();
  });

  it("verifyDocumentToken should return invalid if token not found", async () => {
    (prisma.documentVerificationToken.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await verifyDocumentToken("non_existent_token");
    expect(res.isValid).toBe(false);
    expect(res.message).toContain("invalid");
  });

  it("setSignatureProfileActive should reject an unknown profile id", async () => {
    (prisma.digitalSignatureProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(setSignatureProfileActive("missing-id", false)).rejects.toThrow("Signature profile not found");
    expect(prisma.digitalSignatureProfile.update).not.toHaveBeenCalled();
  });

  it("setSignatureProfileActive should deactivate an existing profile", async () => {
    (prisma.digitalSignatureProfile.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "profile-1", isActive: true });
    (prisma.digitalSignatureProfile.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "profile-1", isActive: false });

    const result = await setSignatureProfileActive("profile-1", false, "admin-1");
    expect(result.isActive).toBe(false);
    expect(prisma.digitalSignatureProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: { isActive: false },
    });
  });
});
