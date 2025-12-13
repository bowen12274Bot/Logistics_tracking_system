export type LoginPayload = { identifier: string; password: string };
export type RegisterPayload = {
  user_name: string;
  email: string;
  password: string;
  phone_number?: string;
  address?: string;
  user_type?: string;
  user_class?: string;
};

export type User = {
  id: string;
  user_name: string;
  phone_number?: string | null;
  address?: string | null;
  email: string;
  user_type: "customer" | "employee";
  user_class:
    | "contract_customer"
    | "non_contract_customer"
    | "customer_service"
    | "driver"
    | "warehouse_staff"
    | "admin";
  billing_preference?:
    | "cash"
    | "credit_card"
    | "bank_transfer"
    | "monthly"
    | "third_party_payment"
    | null;
};

export type AuthResponse = { user: User; token: string };

export type UpdateCustomerPayload = {
  user_id: string;
  user_name?: string;
  phone_number?: string;
  address?: string;
  billing_preference?:
    | "cash"
    | "credit_card"
    | "bank_transfer"
    | "monthly"
    | "third_party_payment";
};

export type UpdateCustomerResponse = {
  success: boolean;
  user: User;
};

export type ContractApplicationPayload = {
  customer_id: string;
  company_name: string;
  tax_id: string;
  contact_person: string;
  contact_phone: string;
  billing_address: string;
  notes?: string;
};

export type ContractApplicationStatus = {
  success: boolean;
  has_application: boolean;
  application_id?: string;
  status?: string;
};

export type CreatePackagePayload = {
  customer_id?: string;
  sender?: string;
  receiver?: string;
  sender_name?: string;
  sender_phone?: string;
  sender_address?: string;
  receiver_name?: string;
  receiver_phone?: string;
  receiver_address?: string;
  weight: number;
  size: string;
  delivery_time: string;
  payment_type: string;
  payment_method?: string;
  declared_value?: number;
  contents_description?: string;
  dangerous_materials?: boolean;
  fragile_items?: boolean;
  international_shipments?: boolean;
  pickup_date?: string;
  pickup_time_window?: string;
  pickup_notes?: string;
  route_path?: string;
  metadata?: Record<string, unknown>;
};

export type PackageRecord = {
  id: string;
  tracking_number?: string;
  customer_id?: string | null;
  sender?: string | null;
  receiver?: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  sender_address?: string | null;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  receiver_address?: string | null;
  weight?: number | null;
  size?: string | null;
  delivery_time?: string | null;
  payment_type?: string | null;
  payment_method?: string | null;
  declared_value?: number | null;
  contents_description?: string | null;
  dangerous_materials?: boolean | null;
  fragile_items?: boolean | null;
  international_shipments?: boolean | null;
  final_billing_date?: string | null;
  route_path?: string | null;
  pickup_date?: string | null;
  pickup_time_window?: string | null;
  pickup_notes?: string | null;
  description_json?: Record<string, unknown>;
};

export type PackageListResponse = {
  success: boolean;
  packages: PackageRecord[];
};

export type MapNode = {
  id: string;
  name: string;
  level: number;
  subtype?: "home" | "store" | null;
  x: number;
  y: number;
};

export type MapEdge = {
  id: number;
  source: string;
  target: string;
  distance: number;
  road_multiple: number;
  cost: number;
};

export type MapResponse = {
  success: boolean;
  nodes: MapNode[];
  edges: MapEdge[];
};

const baseUrl = (import.meta.env.VITE_API_BASE ?? "http://localhost:8787").replace(/\/+$/, "");

const AUTH_STORAGE_KEY = "logisim-auth";

function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.token === "string" ? parsed.token : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const normalizedPath =
    baseUrl.endsWith("/api") && path.startsWith("/api") ? path.replace(/^\/api/, "") : path;
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${baseUrl}${normalizedPath}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export const api = {
  getMap: () =>
    request<MapResponse>("/api/map", {
      method: "GET",
    }),
  getMe: () =>
    request<{ success: boolean; user: User }>("/api/auth/me", {
      method: "GET",
    }),
  customerExists: (query: { phone?: string; name?: string }) => {
    const params = new URLSearchParams();
    if (query.phone) params.set("phone", query.phone);
    if (query.name) params.set("name", query.name);
    return request<{ success: boolean; exists: boolean; user_id?: string }>(
      `/api/customers/exists?${params.toString()}`,
      { method: "GET" },
    );
  },
  login: (payload: LoginPayload) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  register: (payload: RegisterPayload) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createPackage: (payload: CreatePackagePayload) =>
    request<{ success: boolean; package: PackageRecord }>("/api/packages", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCustomerMe: (payload: UpdateCustomerPayload) =>
    request<UpdateCustomerResponse>("/api/customers/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  applyForContract: (payload: ContractApplicationPayload) =>
    request<{
      success: boolean;
      application_id: string;
      status: string;
      message: string;
    }>("/api/customers/contract-application", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getContractApplicationStatus: (customerId: string) =>
    request<ContractApplicationStatus>(
      `/api/customers/contract-application/status?customer_id=${encodeURIComponent(customerId)}`,
      {
        method: "GET",
      },
    ),
  getPackages: (customerId?: string) =>
    request<PackageListResponse>(
      customerId ? `/api/packages?customer_id=${encodeURIComponent(customerId)}` : "/api/packages",
      {
        method: "GET",
      },
    ),
};
