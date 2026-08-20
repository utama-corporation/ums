import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndMarkOverdueTasks } from "../services/dispositionService.js";
import { prisma } from "@ums/db";

vi.mock("@ums/db", () => {
  const tx = {
    task: { update: vi.fn() },
    taskStatusHistory: { create: vi.fn() },
    domainOutboxEvent: { create: vi.fn() },
  };
  return {
    prisma: {
      task: { findMany: vi.fn() },
      $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(tx)),
      __tx: tx,
    },
  };
});

describe("Disposition & SLA Overdue Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should find and mark tasks as OVERDUE if deadline has passed", async () => {
    (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "task-1",
        title: "Test Task",
        deadline: new Date(Date.now() - 10000),
        status: "IN_PROGRESS",
        assignees: [{ userId: "user-1" }],
        disposition: { issuerId: "issuer-1" },
      },
    ]);

    const count = await checkAndMarkOverdueTasks();
    expect(count).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tx = (prisma as any).__tx;
    expect(tx.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { status: "OVERDUE" },
    });
    expect(tx.domainOutboxEvent.create).toHaveBeenCalled();
  });
});
