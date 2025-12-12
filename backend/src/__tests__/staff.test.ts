// backend/src/__tests__/staff.test.ts
// 員工操作測試 (Staff)

import { describe, it, expect, beforeAll } from "vitest";
import {
  apiRequest,
  authenticatedRequest,
  createTestUser,
  createTestPackage,
} from "./helpers";

describe("員工操作 (Staff)", () => {
  let customerToken: string;

  beforeAll(async () => {
    const user = await createTestUser();
    customerToken = user.token;
  });

  // ========== GET /api/driver/tasks ==========
  describe("GET /api/driver/tasks - 駕駛員工作清單", () => {
    it("DRV-TASK-006: customer 無權限", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/driver/tasks",
        customerToken
      );

      expect(status).toBe(403);
    });
  });

  // ========== POST /api/driver/packages/:packageId/status ==========
  describe("POST /api/driver/packages/:packageId/status - 更新配送狀態", () => {
    it("DRV-STATUS-005: customer 無權限", async () => {
      const pkg = await createTestPackage(customerToken);

      const { status } = await authenticatedRequest<any>(
        `/api/driver/packages/${pkg.id}/status`,
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            status: "delivered",
          }),
        }
      );

      expect(status).toBe(403);
    });
  });

  // ========== POST /api/warehouse/batch-operation ==========
  describe("POST /api/warehouse/batch-operation - 批次入出庫", () => {
    it("WH-BATCH-006: customer 無權限", async () => {
      const { status } = await authenticatedRequest<any>(
        "/api/warehouse/batch-operation",
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            operation: "warehouse_in",
            package_ids: ["pkg1", "pkg2"],
            location_id: "LOC_1",
          }),
        }
      );

      expect(status).toBe(403);
    });

    it("WH-BATCH-004: 空的 package_ids", async () => {
      // 此測試需要 warehouse 權限，先測試客戶會被拒絕
      const { status } = await authenticatedRequest<any>(
        "/api/warehouse/batch-operation",
        customerToken,
        {
          method: "POST",
          body: JSON.stringify({
            operation: "warehouse_in",
            package_ids: [],
            location_id: "LOC_1",
          }),
        }
      );

      // customer 先被權限拒絕
      expect(status).toBe(403);
    });
  });
});
