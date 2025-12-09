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
  user_type: 'customer' | 'employee';
  user_class:
    | 'contract_customer'
    | 'non_contract_customer'
    | 'customer_service'
    | 'driver'
    | 'warehouse_staff'
    | 'admin';
};

export type AuthResponse = { user: User; token: string };

export type CreatePackagePayload = {
  customer_id?: string;
  sender?: string;
  receiver?: string;
  weight: number;
  size: string;
  delivery_time: string;
  payment_type: string;
  payment_method?: string;
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
  weight?: number | null;
  size?: string | null;
  delivery_time?: string | null;
  payment_type?: string | null;
  payment_method?: string | null;
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

const baseUrl = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787';

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export const api = {
  login: (payload: LoginPayload) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  register: (payload: RegisterPayload) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createPackage: (payload: CreatePackagePayload) =>
    request<{ success: boolean; package: PackageRecord }>('/api/packages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
