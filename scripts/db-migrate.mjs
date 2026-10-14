// Apply the app's SQL migrations (src/db/migrations/*.sql) in filename order.
//
// Every migration is written to be idempotent, so this is safe to re-run. It
// exists because `drizzle-kit push` is interactive and would offer to drop the
// search columns the intelligence service adds (see CLAUDE.md, "Columns Drizzle
// does not own"); these files only ever add.
//
// Usage: npm run db:migrate

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { Pool } from '@neondatabase/serverless';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'db', 'migrations');
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const file of files) {
    const sql = await readFile(path.join(dir, file), 'utf8');
    await pool.query(sql);
    console.log(`applied ${file}`);
  }
} finally {
  await pool.end();
}
