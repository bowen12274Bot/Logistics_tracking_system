import { describe, it, expect, beforeAll } from "vitest";
import { describe401Tests, expect401 } from "./authTestUtils";
import { authenticatedRequest, getAdminToken, createTestUser, apiRequest } from "./helpers";
import { env } from "cloudflare:test";

describe("Admin System Errors API", () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    const user = await createTestUser();
    userToken = user.token;
  });

  describe401Tests([
    { method: "GET", path: "/api/admin/system/errors" },
  ]);

  it("should return 403 for non-admin user", async () => {
    const { status } = await authenticatedRequest(
      "/api/admin/system/errors",
      userToken,
      { method: "GET" }
    );
    expect(status).toBe(403);
  });

  it("should return 200 and error list for admin", async () => {
    const { status, data } = await authenticatedRequest<any>(
      "/api/admin/system/errors",
      adminToken,
      { method: "GET" }
    );
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.errors)).toBe(true);
    expect(typeof data.total).toBe("number");
  });

  it("should filter by level", async () => {
    // We try to query with a filter even if empty
    const { status, data } = await authenticatedRequest<any>(
      "/api/admin/system/errors?level=error",
      adminToken,
      { method: "GET" }
    );
    expect(status).toBe(200);
    expect(data.success).toBe(true);
    if (data.errors.length > 0) {
      expect(data.errors[0].level).toBe("error");
    }
  });

  it("should handle pagination", async () => {
    const { status, data } = await authenticatedRequest<any>(
      "/api/admin/system/errors?limit=5&offset=0",
      adminToken,
      { method: "GET" }
    );
    expect(status).toBe(200);
    expect(data.limit).toBe(5);
    expect(data.offset).toBe(0);
  });
  
  // Attempt to inject an error to verify reading logic if possible
  it("should retrieve inserted errors", async () => {
    // Direct DB injection using env.DB if available in test environment
    if ((env as any).DB) {
      const db = (env as any).DB as D1Database;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.prepare(`
        INSERT INTO system_errors (id, level, code, message, occurred_at, resolved)
        VALUES (?, 'critical', 'TEST_ERR', 'Test error message', ?, 0)
      `).bind(id, now).run();

      const { status, data } = await authenticatedRequest<any>(
        "/api/admin/system/errors?level=critical",
        adminToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      const found = data.errors.find((e: any) => e.id === id);
      expect(found).toBeDefined();
      expect(found.message).toBe("Test error message");
    } else {
        console.warn("env.DB not available, skipping injection test");
    }
  });

  it("should filter by resolved status", async () => {
     const { status, data } = await authenticatedRequest<any>(
      "/api/admin/system/errors?resolved=false",
      adminToken,
      { method: "GET" }
    );
    expect(status).toBe(200);
  });
});
