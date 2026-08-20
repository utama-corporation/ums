import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "@ums/db";

vi.mock("@ums/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    loginAttempt: {
      create: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
  },
}));

describe("Auth & RBAC Endpoints Integration Test", () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/v1/auth/login with invalid user should return 401", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "invalid", password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("GET /api/v1/me without token should return 401", async () => {
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("GET /api/v1/users without permission should return 401 or 403", async () => {
    const res = await request(app).get("/api/v1/users");
    expect(res.status).toBe(401);
  });
});
