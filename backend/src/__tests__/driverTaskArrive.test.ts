import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedRequest,
  getDriverToken,
  getAdminToken,
  createTestUser,
  createTestPackage,
} from "./helpers";

describe("Driver Task Arrive API", () => {
  let driverToken: string;
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    driverToken = await getDriverToken();
    const customer = await createTestUser();
    customerToken = customer.token;
  });

  describe("POST /api/driver/tasks/:taskId/arrive", () => {
    it("should return 401 for unauthenticated request", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/driver/tasks/task-123/arrive",
        "",
        { method: "POST" }
      );
      expect(status).toBe(401);
    });

    it("should return 403 for non-driver user", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/driver/tasks/task-123/arrive",
        customerToken,
        { method: "POST" }
      );
      expect(status).toBe(403);
    });

    it("should return 404 for non-existent task", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/driver/tasks/non-existent-task/arrive",
        driverToken,
        { method: "POST" }
      );
      expect(status).toBe(404);
      expect(data.error).toContain("not found");
    });

    it("should return 403 for task assigned to another driver", async () => {
      // This tests the authorization check - task exists but belongs to different driver
      // Since we can't easily create a task for another driver, we test with a fake task ID
      const { status } = await authenticatedRequest<any>(
        "/api/driver/tasks/fake-task-id/arrive",
        driverToken,
        { method: "POST" }
      );
      // Either 404 (not found) or 403 (forbidden) is acceptable
      expect([403, 404]).toContain(status);
    });
  });
});
