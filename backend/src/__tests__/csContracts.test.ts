import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, authenticatedRequest, createTestUser, getCustomerServiceToken } from "./helpers";

describe("Customer service contract applications", () => {
  let csToken: string;

  beforeAll(async () => {
    csToken = await getCustomerServiceToken();
  });

  it("CS-CONTRACT-001: customer applies -> CS can list and approve", async () => {
    const user = await createTestUser({ address: "END_HOME_1" });
    const customerToken = user.token;

    const apply = await authenticatedRequest<any>("/api/customers/contract-application", customerToken, {
      method: "POST",
      body: JSON.stringify({
        customer_id: user.user.id,
        company_name: "測試公司",
        tax_id: "12345678",
        contact_person: "王小明",
        contact_phone: "0912345678",
        billing_address: "台北市信義區松仁路 1 號",
        notes: "test",
      }),
    });
    expect(apply.status).toBe(200);
    expect(apply.data.success).toBe(true);
    const applicationId = String(apply.data.application_id ?? "");
    expect(applicationId).toBeTruthy();

    const list = await authenticatedRequest<any>("/api/cs/contract-applications?status=pending&limit=200", csToken);
    expect(list.status).toBe(200);
    expect(list.data.success).toBe(true);
    const items: any[] = list.data.applications ?? [];
    expect(items.some((a) => String(a.id) === applicationId)).toBe(true);

    const approve = await authenticatedRequest<any>(`/api/cs/contract-applications/${encodeURIComponent(applicationId)}`, csToken, {
      method: "PUT",
      body: JSON.stringify({ status: "approved", credit_limit: 100000, review_notes: "ok" }),
    });
    expect(approve.status).toBe(200);
    expect(approve.data.success).toBe(true);
    expect(String(approve.data.status)).toBe("approved");

    // Customer role should be updated to contract_customer after approval.
    const me = await authenticatedRequest<any>("/api/auth/me", customerToken);
    expect(me.status).toBe(200);
    expect(String(me.data.user?.user_class)).toBe("contract_customer");
  });

  it("CS-CONTRACT-403: non-CS cannot list CS contract applications", async () => {
    const customer = await createTestUser({ address: "END_HOME_1" });
    const res = await authenticatedRequest<any>("/api/cs/contract-applications?status=pending", customer.token);
    expect(res.status).toBe(403);
  });
});

