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
};
