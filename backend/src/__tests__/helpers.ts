// backend/src/__tests__/helpers.ts
// 測試輔助函式

export const BASE_URL = "http://localhost:8787";

interface ApiResponse<T> {
  status: number;
  data: T;
}

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const data = await response.json() as T;
  return { status: response.status, data };
}

export async function authenticatedRequest<T>(
  endpoint: string,
  token: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

// 產生唯一測試資料
export const uniqueEmail = () =>
  `test_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
export const uniquePhone = () =>
  `09${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`;

// 建立測試使用者並回傳 token
export async function createTestUser(overrides: Record<string, any> = {}) {
  const userData = {
    user_name: "測試用戶",
    email: uniqueEmail(),
    password: "testpass123",
    phone_number: uniquePhone(),
    address: "10,20",
    ...overrides,
  };

  const { data, status } = await apiRequest<{ token: string; user: any }>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify(userData) }
  );

  if (status !== 200) {
    throw new Error(`Failed to create test user: ${JSON.stringify(data)}`);
  }

  return { ...data, password: userData.password, email: userData.email };
}

// 建立員工使用者（需要 admin token）
export async function createEmployeeUser(
  adminToken: string,
  userClass: string,
  overrides: Record<string, any> = {}
) {
  const userData = {
    user_name: `測試${userClass}`,
    email: uniqueEmail(),
    password: "testpass123",
    phone_number: uniquePhone(),
    user_class: userClass,
    ...overrides,
  };

  const { data, status } = await authenticatedRequest<{ success: boolean; user: any }>(
    "/api/admin/users",
    adminToken,
    { method: "POST", body: JSON.stringify(userData) }
  );

  if (status !== 200) {
    throw new Error(`Failed to create employee user: ${JSON.stringify(data)}`);
  }

  // 登入取得 token
  const loginResult = await apiRequest<{ token: string; user: any }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ identifier: userData.email, password: userData.password }),
    }
  );

  return { ...loginResult.data, password: userData.password, email: userData.email };
}

// 建立測試包裹
export async function createTestPackage(token: string, overrides: Record<string, any> = {}) {
  // 先取得用戶資訊
  const userInfo = await authenticatedRequest<{ user: { id: string } }>(
    "/api/auth/me",
    token
  );

  const customerId = userInfo.data?.user?.id;

  const packageData = {
    customer_id: customerId,
    sender: "寄件者",
    receiver: "收件者",
    weight: 5,
    size: "medium",
    delivery_time: "standard",
    payment_type: "prepaid",
    contents_description: "測試包裹內容",
    ...overrides,
  };

  const { data, status } = await authenticatedRequest<{ success: boolean; package: any }>(
    "/api/packages",
    token,
    { method: "POST", body: JSON.stringify(packageData) }
  );

  if (status !== 200 || !data.success) {
    throw new Error(`Failed to create test package: ${JSON.stringify(data)}`);
  }

  return data.package;
}

// 取得 admin token（使用種子資料中的 admin）
export async function getAdminToken() {
  const { data, status } = await apiRequest<{ token: string; user: any }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ identifier: "admin@example.com", password: "admin123" }),
    }
  );

  if (status !== 200) {
    throw new Error(`Failed to login as admin: ${JSON.stringify(data)}`);
  }

  return data.token;
}

// 取得 driver token
export async function getDriverToken() {
  const { data, status } = await apiRequest<{ token: string; user: any }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ identifier: "driver@example.com", password: "driver123" }),
    }
  );

  if (status !== 200) {
    throw new Error(`Failed to login as driver: ${JSON.stringify(data)}`);
  }

  return data.token;
}

// 取得 warehouse token
export async function getWarehouseToken() {
  const { data, status } = await apiRequest<{ token: string; user: any }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ identifier: "warehouse@example.com", password: "warehouse123" }),
    }
  );

  if (status !== 200) {
    throw new Error(`Failed to login as warehouse: ${JSON.stringify(data)}`);
  }

  return data.token;
}

// 取得 customer service token
export async function getCustomerServiceToken() {
  const { data, status } = await apiRequest<{ token: string; user: any }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ identifier: "cs@example.com", password: "cs123" }),
    }
  );

  if (status !== 200) {
    throw new Error(`Failed to login as customer service: ${JSON.stringify(data)}`);
  }

  return data.token;
}
