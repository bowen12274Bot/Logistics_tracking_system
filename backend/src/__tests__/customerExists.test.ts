import { describe, it, expect, beforeAll } from "vitest";
import { describe401Tests } from "./authTestUtils";
import { authenticatedRequest, createTestUser, getAdminToken } from "./helpers";

describe("Customer Exists API", () => {
  let token: string;
  let testUser: any;

  beforeAll(async () => {
    // We can use any token for auth
    const u = await createTestUser({ 
        user_name: "TestCustomerUnique", 
        phone_number: "0999888777" 
    });
    token = u.token;
    testUser = u;
  });

  describe401Tests([
    { method: "GET", path: "/api/customers/exists" },
  ]);

  it("should return 400 if no query params", async () => {
    const { status } = await authenticatedRequest(
      "/api/customers/exists",
      token,
      { method: "GET" }
    );
    expect(status).toBe(400);
  });

  it("should find existing customer by phone", async () => {
    const { status, data } = await authenticatedRequest<any>(
      `/api/customers/exists?phone=${testUser.user.phone_number}`,
      token,
      { method: "GET" }
    );
    expect(status).toBe(200);
    expect(data.exists).toBe(true);
    expect(data.user_id).toBe(testUser.user.id);
  });

  it("should find existing customer by name", async () => {
    const { status, data } = await authenticatedRequest<any>(
      `/api/customers/exists?name=${encodeURIComponent(testUser.user.user_name)}`,
      token,
      { method: "GET" }
    );
    expect(status).toBe(200);
    expect(data.exists).toBe(true);
  });

  it("should return false for non-existent customer", async () => {
    const { status, data } = await authenticatedRequest<any>(
      `/api/customers/exists?phone=0000000000`,
      token,
      { method: "GET" }
    );
    expect(status).toBe(200);
    expect(data.exists).toBe(false);
  });
});
