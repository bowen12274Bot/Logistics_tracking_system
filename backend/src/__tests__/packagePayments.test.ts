import { describe, expect, it } from "vitest";
import { apiRequest, authenticatedRequest, createTestUser } from "./helpers";

describe("Package charge payments (prepaid/COD)", () => {
  it("PAY-PKG-001: COD package payable by receiver after delivered", async () => {
    const sender = await createTestUser({ user_name: "sender_user" });
    const receiver = await createTestUser({ user_name: "receiver_user" });

    const meSender = await authenticatedRequest<{ user: { id: string } }>("/api/auth/me", sender.token);
    const senderId = meSender.data.user.id;

    const create = await authenticatedRequest<any>("/api/packages", sender.token, {
      method: "POST",
      body: JSON.stringify({
        customer_id: senderId,
        sender_name: "Sender",
        sender_phone: sender.user.phone_number,
        sender_address: "END_HOME_1",
        receiver_name: receiver.user.user_name,
        receiver_phone: receiver.user.phone_number,
        receiver_address: "END_HOME_2",
        weight: 5,
        size: "medium",
        delivery_time: "standard",
        payment_type: "cod",
        payment_method: "credit_card",
      }),
    });
    expect(create.status).toBe(200);
    expect(create.data.success).toBe(true);
    const packageId = create.data.package.id as string;

    const listBefore = await authenticatedRequest<any>("/api/payments/packages", receiver.token);
    expect(listBefore.status).toBe(200);
    const beforeIds = (listBefore.data.items ?? []).map((i: any) => i.package?.id);
    expect(beforeIds).toContain(packageId);

    const payTooEarly = await authenticatedRequest<any>(`/api/payments/packages/${encodeURIComponent(packageId)}`, receiver.token, {
      method: "POST",
      body: JSON.stringify({ payment_method: "credit_card" }),
    });
    expect(payTooEarly.status).toBe(409);

    const delivered = await apiRequest<any>(`/api/packages/${encodeURIComponent(packageId)}/events`, {
      method: "POST",
      body: JSON.stringify({ delivery_status: "delivered", location: "END_HOME_2" }),
    });
    expect(delivered.status).toBe(200);

    const payOk = await authenticatedRequest<any>(`/api/payments/packages/${encodeURIComponent(packageId)}`, receiver.token, {
      method: "POST",
      body: JSON.stringify({ payment_method: "credit_card" }),
    });
    expect(payOk.status).toBe(200);
    expect(payOk.data.success).toBe(true);

    const listAfter = await authenticatedRequest<any>("/api/payments/packages?include_paid=true", receiver.token);
    const paidItem = (listAfter.data.items ?? []).find((i: any) => i.package?.id === packageId);
    expect(paidItem).toBeTruthy();
    expect(paidItem.paid_at).toBeTruthy();
  });
});

