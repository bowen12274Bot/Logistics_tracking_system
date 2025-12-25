import { SELF } from "cloudflare:test";

interface ApiResponse<T> {
  status: number;
  data: T;
}

export async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const url = new URL(endpoint, "http://local.test").toString();
  const response = await SELF.fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  const text = await response.text();
  try {
    const data = JSON.parse(text) as T;
    return { status: response.status, data };
  } catch (error) {
    console.error(`Failed to parse JSON from ${url}. Status: ${response.status}. Body: ${text.slice(0, 500)}`);
    throw error;
  }
}

export async function authenticatedRequest<T>(
  endpoint: string,
  token: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export const uniqueEmail = () => `test_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
export const uniquePhone = () => `09${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`;

export async function createTestUser(overrides: Record<string, any> = {}) {
  const userData = {
    user_name: "測試用戶",
    email: uniqueEmail(),
    password: "testpass123",
    phone_number: uniquePhone(),
    address: "END_HOME_0",
    ...overrides,
  };

  const { data, status } = await apiRequest<{ token: string; user: any }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(userData),
  });

  if (status !== 200) throw new Error(`Failed to create test user: ${JSON.stringify(data)}`);
  return { ...data, password: userData.password, email: userData.email };
}

export async function createEmployeeUser(
  adminToken: string,
  userClass: string,
  overrides: Record<string, any> = {},
) {
  const userData = {
    user_name: `測試${userClass}`,
    email: uniqueEmail(),
    password: "testpass123",
    phone_number: uniquePhone(),
    user_class: userClass,
    ...overrides,
  };

  const { data, status } = await authenticatedRequest<{ success: boolean; user: any }>("/api/admin/users", adminToken, {
    method: "POST",
    body: JSON.stringify(userData),
  });

  if (status !== 200) throw new Error(`Failed to create employee user: ${JSON.stringify(data)}`);

  const loginResult = await apiRequest<{ token: string; user: any }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: userData.email, password: userData.password }),
  });

  return { ...loginResult.data, password: userData.password, email: userData.email };
}

export async function createTestPackage(token: string, overrides: Record<string, any> = {}) {
  const userInfo = await authenticatedRequest<{ user: { id: string } }>("/api/auth/me", token);
  const customerId = userInfo.data?.user?.id;

  const packageData = {
    customer_id: customerId,
    sender: "測試寄件者",
    receiver: "測試收件者",
    weight: 5,
    size: "medium",
    delivery_time: "standard",
    payment_type: "prepaid",
    contents_description: "測試包裹內容",
    ...overrides,
  };

  const { data, status } = await authenticatedRequest<{ success: boolean; package: any }>("/api/packages", token, {
    method: "POST",
    body: JSON.stringify(packageData),
  });

  if (status !== 200 || !data.success) throw new Error(`Failed to create test package: ${JSON.stringify(data)}`);
  return data.package;
}

export async function getAdminToken() {
  const { data, status } = await apiRequest<{ token: string; user: any }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: "admin@example.com", password: "admin123" }),
  });

  if (status !== 200) throw new Error(`Failed to login as admin: ${JSON.stringify(data)}`);
  return data.token;
}

export async function getDriverToken() {
  const { data, status } = await apiRequest<{ token: string; user: any }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: "driver_hub_0@example.com", password: "driver123" }),
  });

  if (status !== 200) throw new Error(`Failed to login as driver: ${JSON.stringify(data)}`);
  return data.token;
}

export async function getWarehouseToken() {
  const { data, status } = await apiRequest<{ token: string; user: any }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: "warehouse_hub_0@example.com", password: "warehouse123" }),
  });

  if (status !== 200) throw new Error(`Failed to login as warehouse: ${JSON.stringify(data)}`);
  return data.token;
}

export async function getCustomerServiceToken() {
  const { data, status } = await apiRequest<{ token: string; user: any }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: "cs@example.com", password: "cs123" }),
  });

  if (status !== 200) throw new Error(`Failed to login as customer service: ${JSON.stringify(data)}`);
  return data.token;
}

