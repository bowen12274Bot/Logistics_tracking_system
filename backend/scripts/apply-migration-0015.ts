import { execSync } from 'child_process';
import path from 'path';

const migrationFile = path.join(__dirname, '../migrations/0015_users_status.sql');
console.log(`Applying migration: ${migrationFile}`);

try {
  execSync(`npx wrangler d1 execute term-project-db --local --file="${migrationFile}"`, { stdio: 'inherit' });
  console.log('Migration applied successfully.');
} catch (error) {
  console.error('Failed to apply migration:', error);
  process.exit(1);
}
