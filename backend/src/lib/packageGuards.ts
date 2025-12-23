export type PackageTerminalStatus = "delivered" | "delivery_failed";

export type ActiveExceptionRow = {
  id: string;
  reason_code: string | null;
  description: string;
  reported_role: string;
  reported_at: string | null;
  location: string | null;
};

export async function getPackageStatus(db: D1Database, packageId: string) {
  const row = await db.prepare("SELECT status FROM packages WHERE id = ? LIMIT 1")
    .bind(packageId)
    .first<{ status: string | null }>();
  return row?.status ?? null;
}

export async function getTerminalStatus(
  db: D1Database,
  packageId: string,
): Promise<PackageTerminalStatus | null> {
  const status = String((await getPackageStatus(db, packageId)) ?? "").trim().toLowerCase();
  if (status === "delivered" || status === "delivery_failed") return status;
  return null;
}

export async function hasActiveException(db: D1Database, packageId: string): Promise<boolean> {
  const row = await db.prepare(
    "SELECT 1 AS ok FROM package_exceptions WHERE package_id = ? AND handled = 0 LIMIT 1",
  )
    .bind(packageId)
    .first<{ ok: number }>();
  return Boolean(row);
}

export async function getActiveException(db: D1Database, packageId: string): Promise<ActiveExceptionRow | null> {
  const ex = await db.prepare(
    `
    SELECT id, reason_code, description, reported_role, reported_at
    FROM package_exceptions
    WHERE package_id = ?
      AND handled = 0
    ORDER BY COALESCE(reported_at, '') DESC
    LIMIT 1
    `,
  )
    .bind(packageId)
    .first<{
      id: string;
      reason_code: string | null;
      description: string;
      reported_role: string;
      reported_at: string | null;
    }>();
  if (!ex) return null;

  const loc = await db.prepare(
    `
    SELECT location
    FROM package_events
    WHERE package_id = ?
      AND delivery_status = 'exception'
    ORDER BY events_at DESC
    LIMIT 1
    `,
  )
    .bind(packageId)
    .first<{ location: string | null }>();

  return {
    id: String(ex.id),
    reason_code: ex.reason_code ?? null,
    description: String(ex.description ?? ""),
    reported_role: String(ex.reported_role ?? ""),
    reported_at: ex.reported_at ?? null,
    location: loc?.location ?? null,
  };
}

