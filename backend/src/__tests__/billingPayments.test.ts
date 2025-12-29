import { describe, it, expect, beforeAll } from "vitest";
import {
  authenticatedRequest,
  createTestUser,
} from "./helpers";

describe("Billing Payments API", () => {
  let customerToken: string;

  beforeAll(async () => {
    const customer = await createTestUser();
    customerToken = customer.token;
  });

  describe("POST /api/billing/payments", () => {
    it("should return 401 for unauthenticated request", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/billing/payments",
        "",
        {
          method: "POST",
          body: JSON.stringify({
            bill_id: "bill-123",
            payment_method: "credit_card",
            amount: 1000,
          }),
        }
      );
      expect(status).toBe(401);
    });

    it("should return 404 for non-existent bill", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/billing/payments",
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            bill_id: "non-existent-bill",
            payment_method: "credit_card",
            amount: 1000,
          }),
        }
      );
      expect(status).toBe(404);
      expect(data.error).toContain("帳單不存在");
    });
  });

  describe("GET /api/billing/payments", () => {
    it("should return 401 for unauthenticated request", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/billing/payments",
        "",
        { method: "GET" }
      );
      expect(status).toBe(401);
    });

    it("should return empty list for user with no payments", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/billing/payments",
        customerToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.payments).toEqual([]);
    });

    it("should accept date_from and date_to filters", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/billing/payments?date_from=2025-01-01&date_to=2025-12-31",
        customerToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should accept bill_id filter", async () => {
      const { status, data } = await authenticatedRequest<any>(
        "/api/billing/payments?bill_id=some-bill-id",
        customerToken,
        { method: "GET" }
      );
      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
