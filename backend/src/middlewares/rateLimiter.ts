import { Next } from "hono";
import { AppContext } from "../types";

// 角色速率限制配置 (requests per window)
type RateLimitConfig = { limit: number; windowMs: number };

const ROLE_LIMITS: Record<string, RateLimitConfig> = {
  // 員工類 - 高頻操作場景
  driver: { limit: 300, windowMs: 60000 },           // 300/分鐘
  warehouse_staff: { limit: 200, windowMs: 60000 },  // 200/分鐘
  customer_service: { limit: 150, windowMs: 60000 }, // 150/分鐘
  admin: { limit: 500, windowMs: 60000 },            // 500/分鐘

  // 客戶類
  contract_customer: { limit: 100, windowMs: 60000 },     // 100/分鐘
  non_contract_customer: { limit: 80, windowMs: 60000 },  // 80/分鐘

  // 預設/匿名
  anonymous: { limit: 60, windowMs: 60000 },  // 60/分鐘
  default: { limit: 100, windowMs: 60000 },   // 100/分鐘 (fallback)
};

type RateLimitRecord = {
  key: string;
  user_id: string | null;
  role: string | null;
  count: number;
  last_request_at: number;
};

// 從 Authorization header 解析 token 並獲取用戶資訊
async function getUserFromToken(
  db: D1Database,
  authHeader: string | undefined
): Promise<{ userId: string; role: string } | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;

  try {
    const result = await db
      .prepare(
        `SELECT u.id, u.user_class 
         FROM tokens t 
         JOIN users u ON t.user_id = u.id 
         WHERE t.id = ? 
         LIMIT 1`
      )
      .bind(token)
      .first<{ id: string; user_class: string }>();

    if (!result) return null;
    return { userId: result.id, role: result.user_class };
  } catch {
    return null;
  }
}

function getRateLimitConfig(role: string | null): RateLimitConfig {
  if (!role) return ROLE_LIMITS.anonymous;
  return ROLE_LIMITS[role] || ROLE_LIMITS.default;
}

export const rateLimiter = async (c: AppContext, next: Next) => {
  // If no DB (e.g. testing context without bindings), skip
  if (!c.env.DB) return next();

  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  // Allow localhost/unknown in dev
  if (ip === "unknown" || ip === "127.0.0.1") return next();

  const authHeader = c.req.header("Authorization");
  const userInfo = await getUserFromToken(c.env.DB, authHeader);

  // 決定 rate limit key: 認證用戶使用 user_id，匿名使用 IP
  const key = userInfo ? `user:${userInfo.userId}` : `ip:${ip}`;
  const role = userInfo?.role ?? null;
  const config = getRateLimitConfig(role);
  const now = Date.now();

  try {
    const record = await c.env.DB.prepare(
      "SELECT key, user_id, role, count, last_request_at FROM rate_limits WHERE key = ?"
    )
      .bind(key)
      .first<RateLimitRecord>();

    let currentCount = 0;
    let remaining = config.limit;

    if (record) {
      // Check window
      if (now - record.last_request_at > config.windowMs) {
        // Reset window - async update
        currentCount = 1;
        remaining = config.limit - 1;
        const p = c.env.DB.prepare(
          "UPDATE rate_limits SET count = 1, last_request_at = ?, role = ? WHERE key = ?"
        )
          .bind(now, role, key)
          .run();
        if (c.executionCtx) c.executionCtx.waitUntil(p);
        else await p;
      } else {
        // Check limit
        currentCount = record.count + 1;
        remaining = Math.max(0, config.limit - currentCount);

        if (record.count >= config.limit) {
          // 設置速率限制標頭
          c.header("X-RateLimit-Limit", String(config.limit));
          c.header("X-RateLimit-Remaining", "0");
          c.header("X-RateLimit-Reset", String(Math.ceil((record.last_request_at + config.windowMs) / 1000)));
          c.header("Retry-After", String(Math.ceil((record.last_request_at + config.windowMs - now) / 1000)));
          return c.text("Too Many Requests", 429);
        }

        // Increment - async update
        const p = c.env.DB.prepare(
          "UPDATE rate_limits SET count = count + 1, last_request_at = ? WHERE key = ?"
        )
          .bind(now, key)
          .run();
        if (c.executionCtx) c.executionCtx.waitUntil(p);
        else await p;
      }
    } else {
      // Insert new - async
      currentCount = 1;
      remaining = config.limit - 1;
      const p = c.env.DB.prepare(
        "INSERT INTO rate_limits (key, user_id, role, count, last_request_at) VALUES (?, ?, ?, 1, ?)"
      )
        .bind(key, userInfo?.userId ?? null, role, now)
        .run();
      if (c.executionCtx) c.executionCtx.waitUntil(p);
      else await p;
    }

    // 設置速率限制標頭
    c.header("X-RateLimit-Limit", String(config.limit));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil((now + config.windowMs) / 1000)));
  } catch (e) {
    console.error("Rate limiter error:", e);
    // Fail open if DB error
  }

  await next();
};

// 用於測試的輔助函數
export function getRoleLimits() {
  return { ...ROLE_LIMITS };
}
