import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndMarkOverdueTasks } from "../services/dispositionService.js";
import { prisma } from "@ums/db";

vi.mock("@ums/db", () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    taskStatusHistory: {
      create: vi.fn(),
    },
  },
}));

describe("Disposition & SLA Overdue Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should find and mark tasks as OVERDUE if deadline has passed", async () => {
    (prisma.task.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "task-1", deadline: new Date(Date.now() - 10000), status: "IN_PROGRESS", assignees: [{ userId: "user-1" }] },
    ]);

    const count = await checkAndMarkOverdueTasks();
    expect(count).toBe(1);
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: "task-1" },
      data: { status: "OVERDUE" },
    });
  });
});
