import { beforeAll } from "vitest";
import { env } from "cloudflare:test";

import m0000 from "../../migrations/0000_users.sql?raw";
import m0001 from "../../migrations/0001_packages.sql?raw";
import m0002 from "../../migrations/0002_package_events.sql?raw";
import m0003 from "../../migrations/0003_payments.sql?raw";
import m0004 from "../../migrations/0004_monthly_billing.sql?raw";
import m0005 from "../../migrations/0005_monthly_billing_items.sql?raw";
import m0007 from "../../migrations/0007_virtual_map_seed.sql?raw";
import m0008 from "../../migrations/0008_contract_applications.sql?raw";
import m0009 from "../../migrations/0009_tokens.sql?raw";
import m0010 from "../../migrations/0010_system_errors.sql?raw";
import m0011 from "../../migrations/0011_seed_test_users.sql?raw";
import m0012 from "../../migrations/0012_package_exceptions.sql?raw";
import m0013 from "../../migrations/0013_delivery_tasks.sql?raw";
import m0014 from "../../migrations/0014_vehicles.sql?raw";
import m0015 from "../../migrations/0015_vehicle_cargo.sql?raw";

const migrations = [
  m0000,
  m0001,
  m0002,
  m0003,
  m0004,
  m0005,
  m0007,
  m0008,
  m0009,
  m0010,
  m0011,
  m0012,
  m0013,
  m0014,
  m0015,
];

const splitSqlStatements = (sql: string) => {
  const normalized = sql.replace(/\r\n/g, "\n");
  const withoutBlockComments = normalized.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutComments = withoutBlockComments.replace(/^\s*--.*$/gm, "");

  const statements: string[] = [];
  let buffer = "";
  let inTrigger = false;

  const pushStatement = () => {
    const trimmed = buffer.trim();
    buffer = "";
    inTrigger = false;
    if (!trimmed) return;
    if (!/[A-Za-z]/.test(trimmed)) return;
    statements.push(trimmed.endsWith(";") ? trimmed : `${trimmed};`);
  };

  for (let i = 0; i < withoutComments.length; i++) {
    const ch = withoutComments[i];
    buffer += ch;

    if (!inTrigger && /^\s*CREATE\s+TRIGGER\b/i.test(buffer)) {
      inTrigger = true;
    }

    if (ch !== ";") continue;

    if (inTrigger) {
      if (/\bEND\s*;$/i.test(buffer.trimEnd())) {
        pushStatement();
      }
      continue;
    }

    pushStatement();
  }

  pushStatement();
  return statements;
};

beforeAll(async () => {
  const hasUsers = await env.DB.prepare(
    "SELECT 1 as ok FROM sqlite_master WHERE type='table' AND name='users' LIMIT 1",
  ).first();

  if (hasUsers) return;

  for (const sql of migrations) {
    for (const statement of splitSqlStatements(sql)) {
      try {
        await env.DB.prepare(statement).run();
      } catch (err: any) {
        const preview = statement.replace(/\s+/g, " ").slice(0, 200);
        throw new Error(`D1 migration failed on statement: ${preview}`);
      }
    }
  }
});
