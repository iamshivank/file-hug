import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('Please define the DATABASE_URL environment variable inside .env.local');
}

// The WebSocket-backed driver (not neon-http) — MemoryService relies on
// db.transaction() to keep bidirectional connection writes atomic, and the HTTP
// driver has no transaction support.
const globalForDb = globalThis as unknown as { pool?: Pool };

const pool = globalForDb.pool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== 'production') globalForDb.pool = pool;

export const db = drizzle(pool);
