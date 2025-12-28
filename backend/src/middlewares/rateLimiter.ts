import { Next } from "hono";
import { AppContext } from "../types";

const LIMIT = 100; // requests per window
const WINDOW_MS = 60 * 1000; // 1 minute

export const rateLimiter = async (c: AppContext, next: Next) => {
  // If no DB (e.g. testing context without bindings), skip
  if (!c.env.DB) return next();

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  // Allow localhost/unknown in dev
  if (ip === 'unknown' || ip === '127.0.0.1') return next();

  const key = `rate_limit:${ip}`;
  const now = Date.now();

  try {
    const record = await c.env.DB.prepare(
      "SELECT count, last_request_at FROM rate_limits WHERE key = ?"
    ).bind(key).first<{ count: number, last_request_at: number }>();

    if (record) {
      // Check window
      if (now - record.last_request_at > WINDOW_MS) {
        // Reset window - async update
        const p = c.env.DB.prepare(
          "UPDATE rate_limits SET count = 1, last_request_at = ? WHERE key = ?"
        ).bind(now, key).run();
        if (c.executionCtx) c.executionCtx.waitUntil(p);
        else await p;
      } else {
        // Check limit
        if (record.count >= LIMIT) {
          return c.text("Too Many Requests", 429);
        }
        // Increment - async update
        const p = c.env.DB.prepare(
          "UPDATE rate_limits SET count = count + 1, last_request_at = ? WHERE key = ?"
        ).bind(now, key).run();
         if (c.executionCtx) c.executionCtx.waitUntil(p);
         else await p;
      }
    } else {
      // Insert new - async
      const p = c.env.DB.prepare(
        "INSERT INTO rate_limits (key, count, last_request_at) VALUES (?, 1, ?)"
      ).bind(key, now).run();
      if (c.executionCtx) c.executionCtx.waitUntil(p);
      else await p;
    }
  } catch (e) {
    console.error("Rate limiter error:", e);
    // Fail open if DB error
  }

  await next();
};
