import { execSync } from "node:child_process";
import path from "node:path";

const migrationFile = path.resolve(process.cwd(), "migrations", "0015_vehicle_cargo.sql");
console.log(`Applying migration: ${migrationFile}`);

try {
  execSync(`npx wrangler d1 execute term-project-db --local --file="${migrationFile}"`, {
    stdio: "inherit",
  });
  console.log("Migration applied successfully.");
} catch (error) {
  console.error("Failed to apply migration:", error);
  process.exit(1);
}
