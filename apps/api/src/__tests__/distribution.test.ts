import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashToken, getExternalMemoByToken } from "../services/distributionService.js";
import { prisma } from "@ums/db";

vi.mock("@ums/db", () => ({
  prisma: {
    externalRecipientAccess: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
  },
}));

describe("Distribution & External Access Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate deterministic SHA-256 token hash", () => {
    const rawToken = "test_raw_token_12345";
    const hash1 = hashToken(rawToken);
    const hash2 = hashToken(rawToken);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("should throw ForbiddenError if external memo is CONFIDENTIAL", async () => {
    (prisma.externalRecipientAccess.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "access-1",
      tokenHash: "hash123",
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
      distributionRecipient: {
        distribution: {
          memo: {
            id: "memo-1",
            title: "Confidential Memo",
            classification: "CONFIDENTIAL",
          },
        },
      },
    } as unknown as Record<string, unknown>);

    await expect(getExternalMemoByToken("test_raw_token_12345")).rejects.toThrow("Confidential memos cannot be accessed via external token link");
  });
});
