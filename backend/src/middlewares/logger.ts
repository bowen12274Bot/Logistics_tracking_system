import { Next } from "hono";
import { AppContext } from "../types";

export const accessLogger = async (c: AppContext, next: Next) => {
  const start = Date.now();
  
  await next();
  
  const duration = Date.now() - start;
  const user = c.get('user') as any;
  const userId = user?.id || null;
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const ua = c.req.header('User-Agent') || '';

  const logPromise = async () => {
    try {
      if (c.env.DB) {
        await c.env.DB.prepare(
          `INSERT INTO access_logs (id, user_id, method, path, status, duration_ms, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          userId,
          c.req.method,
          c.req.path,
          c.res.status,
          duration,
          ip,
          ua
        ).run();
      }
      
      console.log(`[${c.req.method}] ${c.req.path} ${c.res.status} - ${duration}ms${userId ? ` (User: ${userId})` : ''}`);
    } catch (e) {
      console.error('Failed to write access log:', e);
    }
  };

  if (c.executionCtx) {
    c.executionCtx.waitUntil(logPromise());
  } else {
    // Fallback for environments without executionCtx (e.g. testing)
    await logPromise();
  }
};
