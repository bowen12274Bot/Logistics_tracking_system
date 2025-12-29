import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedRequest,
  getAdminToken,
  createTestUser,
  createTestPackage,
} from "./helpers";

describe("Billing Admin API", () => {
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    const customer = await createTestUser();
    customerToken = customer.token;
  });

  describe("PATCH /api/admin/billing/bills/:billId", () => {
    it("should return 401 for unauthenticated request", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/admin/billing/bills/bill-123",
        "",
        {
          method: "PATCH",
          body: JSON.stringify({ status: "paid" }),
        }
      );
      expect(status).toBe(401);
    });

    it("should return 403 for non-admin user", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/admin/billing/bills/bill-123",
        customerToken,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "paid" }),
        }
      );
      expect(status).toBe(403);
    });

    it("should return success with no changes when body is empty", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/admin/billing/bills/non-existent-bill",
        adminToken,
        {
          method: "PATCH",
          body: JSON.stringify({}),
        }
      );
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("No changes");
    });
  });

  describe("POST /api/admin/billing/bills/:billId/items", () => {
    it("should return 401 for unauthenticated request", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/admin/billing/bills/bill-123/items",
        "",
        {
          method: "POST",
          body: JSON.stringify({ package_id: "pkg-123" }),
        }
      );
      expect(status).toBe(401);
    });

    it("should return 403 for non-admin user", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/admin/billing/bills/bill-123/items",
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({ package_id: "pkg-123" }),
        }
      );
      expect(status).toBe(403);
    });

    it("should return 404 for non-existent package", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/admin/billing/bills/bill-123/items",
        adminToken,
        {
          method: "POST",
          body: JSON.stringify({ package_id: "non-existent-pkg" }),
        }
      );
      expect(status).toBe(404);
    });
  });

  describe("DELETE /api/admin/billing/bills/:billId/items/:itemId", () => {
    it("should return 401 for unauthenticated request", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/admin/billing/bills/bill-123/items/item-123",
        "",
        { method: "DELETE" }
      );
      expect(status).toBe(401);
    });

    it("should return 403 for non-admin user", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/admin/billing/bills/bill-123/items/item-123",
        customerToken,
        { method: "DELETE" }
      );
      expect(status).toBe(403);
    });

    it("should return 404 for non-existent item", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/admin/billing/bills/bill-123/items/non-existent-item",
        adminToken,
        { method: "DELETE" }
      );
      expect(status).toBe(404);
    });
  });
});
