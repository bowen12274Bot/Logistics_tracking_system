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
  status?: string | null;
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
  created_at?: string | null;
  estimated_delivery?: string | null;
};

export type PackageListResponse = {
  success: boolean;
  packages: PackageRecord[];
};

export type PackageEventRecord = {
  id: string;
  package_id: string;
  delivery_status: string;
  delivery_details?: string | null;
  events_at: string;
  location?: string | null;
};

export type PackageStatusResponse = {
  success: boolean;
  package: PackageRecord;
  events: PackageEventRecord[];
  vehicle: { id: string; vehicle_code: string } | null;
};

export type TrackingPublicResponse = {
  success: boolean;
  tracking_number: string;
  current_status: string;
  current_location: string | null;
  estimated_delivery: string | null;
  updated_at?: string | null;
  events: Array<{
    status: string;
    description: string | null;
    location: string | null;
    timestamp: string;
  }>;
};

export type TrackingSearchQuery = {
  tracking_number?: string;
  customer_id?: string;
  customer_account?: string;
  date_from?: string;
  date_to?: string;
  vehicle_id?: string;
  location_id?: string;
  status_group?: "in_transit" | "history";
  status?: string;
  exception_only?: "true" | "false";
};

export type TrackingSearchResponse = {
  success: boolean;
  packages: Array<
    PackageRecord & {
      current_location?: string | null;
      current_updated_at?: string | null;
    }
  >;
  total: number;
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

export type MapRouteResponse = {
  success: boolean;
  route: {
    from: string;
    to: string;
    path: string[];
    total_cost: number;
  };
};

export type VehicleRecord = {
  id: string;
  vehicle_code: string;
  home_node_id: string | null;
  current_node_id: string | null;
  updated_at: string | null;
};

export type VehicleMeResponse = {
  success: boolean;
  vehicle: VehicleRecord;
};

export type VehicleMovePayload = { fromNodeId: string; toNodeId: string };
export type VehicleMoveResponse = {
  success: boolean;
  vehicle?: VehicleRecord;
};

export type DriverTaskScope = "assigned" | "handoff";
export type DeliveryTaskRecord = {
  id: string;
  package_id: string;
  task_type: string;
  from_location: string | null;
  to_location: string | null;
  assigned_driver_id?: string | null;
  status: string;
  segment_index?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  tracking_number?: string | null;
  package_status?: string | null;
  sender_address?: string | null;
  receiver_address?: string | null;
  delivery_time?: string | null;
  payment_type?: string | null;
  payment_amount?: number | null;
  payment_method?: string | null;
  paid_at?: string | null;
  estimated_delivery?: string | null;
};

export type DriverExceptionRecord = {
  id: string;
  package_id: string;
  tracking_number?: string | null;
  package_status?: string | null;
  reason_code?: string | null;
  description?: string | null;
  reported_at?: string | null;
  handled?: number | null;
  handled_at?: string | null;
};

export type DriverTasksResponse = {
  success: boolean;
  scope: DriverTaskScope;
  node_id?: string | null;
  tasks: DeliveryTaskRecord[];
};

export type DeliveryType = "overnight" | "two_day" | "standard" | "economy";
export type SpecialMark = "fragile" | "dangerous" | "international";

export type PackageEstimatePayload = {
  fromNodeId: string;
  toNodeId: string;
  weightKg: number;
  dimensionsCm: { length: number; width: number; height: number };
  deliveryType: DeliveryType;
  specialMarks?: SpecialMark[];
};

export type PackageEstimateResponse = {
  success: boolean;
  estimate: {
    fromNodeId: string;
    toNodeId: string;
    route_cost: number;
    route_path: string[];
    route_cost_norm: number;
    box_type: "envelope" | "S" | "M" | "L";
    base: number;
    shipping: number;
    weight_surcharge: number;
    international_multiplier_applied: number;
    mark_fee: number;
    calculated_price: number;
    min_price: number;
    max_price: number;
    total_cost: number;
    estimated_delivery_date: string;
  };
};

// API base URL:
// - Dev: 預設打本機 wrangler dev (http://localhost:8787)
// - Prod: 建議用 VITE_API_BASE 指到 Cloudflare Worker；沒設定時 fallback 同網域 (Pages/自架反向代理)
const fallbackBaseUrl = import.meta.env.DEV ? "http://127.0.0.1:8787" : window.location.origin;
const baseUrl = (import.meta.env.VITE_API_BASE ?? fallbackBaseUrl).replace(/\/+$/, "");

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
    const messageParts = [body.error || res.statusText].filter(Boolean);
    if (body.from && body.to) messageParts.push(`(from=${body.from}, to=${body.to})`);
    if (body.reason) messageParts.push(`[reason=${body.reason}]`);
    throw new Error(messageParts.join(" "));
  }
  return res.json();
}

export const api = {
  getMap: () =>
    request<MapResponse>("/api/map", {
      method: "GET",
    }),
  getMapRoute: (params: { from: string; to: string }) => {
    const qs = new URLSearchParams({ from: params.from, to: params.to });
    return request<MapRouteResponse>(`/api/map/route?${qs.toString()}`, { method: "GET" });
  },
  getVehicleMe: () =>
    request<VehicleMeResponse>("/api/vehicles/me", {
      method: "GET",
    }),
  getVehicleCargoMe: () =>
    request<{
      success: boolean;
      vehicle_id: string;
      cargo: Array<{
        package_id: string;
        tracking_number: string | null;
        package_status?: string | null;
        loaded_at: string | null;
      }>;
    }>("/api/vehicles/me/cargo", { method: "GET" }),
  moveVehicleMe: (payload: VehicleMovePayload) =>
    request<VehicleMoveResponse>("/api/vehicles/me/move", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getDriverTasks: (scope: DriverTaskScope) => {
    const qs = new URLSearchParams({ scope });
    return request<DriverTasksResponse>(`/api/driver/tasks?${qs.toString()}`, { method: "GET" });
  },
  acceptDriverTask: (taskId: string) =>
    request<{ success: boolean }>(`/api/driver/tasks/${encodeURIComponent(taskId)}/accept`, {
      method: "POST",
    }),
  completeDriverTask: (taskId: string) =>
    request<{ success: boolean }>(`/api/driver/tasks/${encodeURIComponent(taskId)}/complete`, {
      method: "POST",
    }),
  pickupDriverTask: (taskId: string) =>
    request<{ success: boolean; cargo_id: string }>(`/api/driver/tasks/${encodeURIComponent(taskId)}/pickup`, {
      method: "POST",
    }),
  dropoffDriverTask: (taskId: string) =>
    request<{ success: boolean; status: string }>(`/api/driver/tasks/${encodeURIComponent(taskId)}/dropoff`, {
      method: "POST",
    }),
  enrouteDriverTask: (taskId: string) =>
    request<{ success: boolean; status: string; location: string | null }>(`/api/driver/tasks/${encodeURIComponent(taskId)}/enroute`, {
      method: "POST",
    }),
  driverUpdatePackageStatus: (packageId: string, payload: { status: string; note?: string; location?: string }) =>
    request<{ success: boolean; message?: string; event_id?: string }>(
      `/api/driver/packages/${encodeURIComponent(packageId)}/status`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  driverReportPackageException: (
    packageId: string,
    payload: { reason_code?: string; description: string; location?: string },
  ) =>
    request<{ success: boolean; exception_id: string }>(
      `/api/driver/packages/${encodeURIComponent(packageId)}/exception`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  getDriverExceptionReports: (limit = 50) => {
    const qs = new URLSearchParams({ limit: String(limit) });
    return request<{ success: boolean; exceptions: DriverExceptionRecord[] }>(
      `/api/driver/exceptions?${qs.toString()}`,
      { method: "GET" },
    );
  },
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
  estimatePackage: (payload: PackageEstimatePayload) =>
    request<PackageEstimateResponse>("/api/packages/estimate", {
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
  getPackageStatus: (packageId: string) =>
    request<PackageStatusResponse>(`/api/packages/${encodeURIComponent(packageId)}/status`, { method: "GET" }),
  searchTracking: (query: TrackingSearchQuery) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      params.set(key, String(value));
    }
    return request<TrackingSearchResponse>(`/api/tracking/search?${params.toString()}`, { method: "GET" });
  },
  getTrackingPublic: (trackingNumber: string) =>
    request<TrackingPublicResponse>(`/api/tracking/${encodeURIComponent(trackingNumber)}`, { method: "GET" }),
};
