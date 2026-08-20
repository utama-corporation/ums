import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";

vi.mock("@ums/db", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  },
}));

describe("Health API Endpoints", () => {
  const app = createApp();

  it("GET /api/v1/health should return 200 OK", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("pass");
    expect(res.body.service).toBe("utama-memo-system-api");
  });

  it("GET /api/v1/ready should return 200 ready when DB is connected", async () => {
    const res = await request(app).get("/api/v1/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.database).toBe("connected");
  });
});
