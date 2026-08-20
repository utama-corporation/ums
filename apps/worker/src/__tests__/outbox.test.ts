import { describe, it, expect, vi } from "vitest";
import { processOutboxEvent } from "../outboxWorker.js";

vi.mock("@ums/db", () => ({
  prisma: {
    memo: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../mailer.js", () => ({
  sendEmailNotification: vi.fn().mockResolvedValue(true),
}));

describe("Transactional Outbox Worker Processor", () => {
  it("should handle unknown event type gracefully", async () => {
    await expect(
      processOutboxEvent({
        id: "evt-1",
        eventType: "UNKNOWN_EVENT",
        aggregateType: "Memo",
        aggregateId: "memo-1",
        payloadJson: "{}",
      })
    ).resolves.not.toThrow();
  });
});
