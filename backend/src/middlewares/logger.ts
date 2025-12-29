import { Next } from "hono";
import { AppContext } from "../types";

// ============================================================
// Business-level Logging Types and Functions
// ============================================================

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface BusinessLogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;    // e.g., 'auth', 'package', 'billing', 'exception', 'driver', 'warehouse', 'admin'
  action: string;      // e.g., 'login_success', 'package_created', 'exception_reported'
  userId?: string | null;
  resourceId?: string | null; // e.g., packageId, billId, taskId
  details?: Record<string, unknown>;
  error?: string;
}

/**
 * Core business logging function.
 * Outputs structured log entries to console for debugging and monitoring.
 */
export function logBusiness(entry: Omit<BusinessLogEntry, 'timestamp'>): void {
  const fullEntry: BusinessLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  const prefix = `[${fullEntry.level.toUpperCase()}][${fullEntry.category}]`;
  const userInfo = fullEntry.userId ? ` user=${fullEntry.userId}` : '';
  const resourceInfo = fullEntry.resourceId ? ` resource=${fullEntry.resourceId}` : '';
  const detailsInfo = fullEntry.details ? ` ${JSON.stringify(fullEntry.details)}` : '';
  const errorInfo = fullEntry.error ? ` error="${fullEntry.error}"` : '';

  const message = `${prefix} ${fullEntry.action}${userInfo}${resourceInfo}${detailsInfo}${errorInfo}`;

  switch (fullEntry.level) {
    case 'error':
      console.error(message);
      break;
    case 'warn':
      console.warn(message);
      break;
    case 'debug':
      console.debug(message);
      break;
    default:
      console.log(message);
  }
}

// ============================================================
// Convenience Logging Functions
// ============================================================

/**
 * Log authentication-related events (login, register, token validation, permission checks)
 */
export function logAuth(
  action: string,
  level: LogLevel = 'info',
  userId?: string | null,
  details?: Record<string, unknown>,
  error?: string
): void {
  logBusiness({ level, category: 'auth', action, userId, details, error });
}

/**
 * Log package-related events (creation, status changes, delivery)
 */
export function logPackage(
  action: string,
  level: LogLevel = 'info',
  userId?: string | null,
  packageId?: string | null,
  details?: Record<string, unknown>,
  error?: string
): void {
  logBusiness({ level, category: 'package', action, userId, resourceId: packageId, details, error });
}

/**
 * Log billing-related events (bill creation, payment, adjustments)
 */
export function logBilling(
  action: string,
  level: LogLevel = 'info',
  userId?: string | null,
  billId?: string | null,
  details?: Record<string, unknown>,
  error?: string
): void {
  logBusiness({ level, category: 'billing', action, userId, resourceId: billId, details, error });
}

/**
 * Log exception-related events (package exceptions, error handling)
 */
export function logException(
  action: string,
  level: LogLevel = 'warn',
  userId?: string | null,
  resourceId?: string | null,
  details?: Record<string, unknown>,
  error?: string
): void {
  logBusiness({ level, category: 'exception', action, userId, resourceId, details, error });
}

/**
 * Log driver-related events (task actions, cargo operations, cash collection)
 */
export function logDriver(
  action: string,
  level: LogLevel = 'info',
  userId?: string | null,
  taskId?: string | null,
  details?: Record<string, unknown>,
  error?: string
): void {
  logBusiness({ level, category: 'driver', action, userId, resourceId: taskId, details, error });
}

/**
 * Log warehouse-related events (receiving, dispatching, batch operations)
 */
export function logWarehouse(
  action: string,
  level: LogLevel = 'info',
  userId?: string | null,
  resourceId?: string | null,
  details?: Record<string, unknown>,
  error?: string
): void {
  logBusiness({ level, category: 'warehouse', action, userId, resourceId, details, error });
}

/**
 * Log admin-related events (user management, contract reviews, system operations)
 */
export function logAdmin(
  action: string,
  level: LogLevel = 'info',
  userId?: string | null,
  targetId?: string | null,
  details?: Record<string, unknown>,
  error?: string
): void {
  logBusiness({ level, category: 'admin', action, userId, resourceId: targetId, details, error });
}

// ============================================================
// HTTP Access Logging Middleware (existing functionality)
// ============================================================

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
