
import type { AppContext } from "../types";

export interface AuthUser {
  id: string;
  user_name: string;
  email: string;
  user_type: string;
  user_class: string;
  phone_number: string | null;
  address: string | null;
  billing_preference: string | null;
}

export type AuthResult<T = AuthUser> = 
  | { ok: true; user: T }
  | { ok: false; res: Response };

export async function requireAuth(c: AppContext): Promise<AuthResult> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, res: c.json({ error: "Token missing" }, 401) };
  }

  const token = authHeader.replace("Bearer ", "");
  const tokenRecord = await c.env.DB.prepare("SELECT user_id FROM tokens WHERE id = ?")
    .bind(token)
    .first<{ user_id: string }>();

  if (!tokenRecord) {
    return { ok: false, res: c.json({ error: "Invalid token" }, 401) };
  }

  const user = await c.env.DB.prepare(
    "SELECT id, user_name, phone_number, address, email, user_type, user_class, billing_preference FROM users WHERE id = ?"
  )
    .bind(tokenRecord.user_id)
    .first<AuthUser>();

  if (!user) {
    return { ok: false, res: c.json({ error: "User not found" }, 401) };
  }

  return { ok: true, user };
}

export async function requireRole(c: AppContext, roles: string[]): Promise<AuthResult> {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth;

  // Check if user_class OR user_type matches any of the allowed roles
  // user_type is usually 'customer' or 'admin', user_class is 'driver', 'warehouse', 'customer_service' etc.
  if (!roles.includes(auth.user.user_class) && !roles.includes(auth.user.user_type)) {
    return { ok: false, res: c.json({ error: "Forbidden" }, 403) };
  }
  return auth;
}

export async function requireDriver(c: AppContext): Promise<AuthResult> {
  return requireRole(c, ["driver"]);
}

export async function requireWarehouse(c: AppContext): Promise<AuthResult> {
  return requireRole(c, ["warehouse_staff"]);
}

export async function requireAdmin(c: AppContext): Promise<AuthResult> {
  return requireRole(c, ["admin"]);
}

export async function requireCustomerService(c: AppContext): Promise<AuthResult> {
  return requireRole(c, ["customer_service"]);
}
