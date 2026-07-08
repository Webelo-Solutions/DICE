import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './client'

// Resolves the migrations folder both in dev (run from server/db) and in the
// bundled production build (copied next to the bundle). Override with
// DICE_MIGRATIONS_DIR when the layout differs.
export function migrationsDir(): string {
  if (process.env.DICE_MIGRATIONS_DIR) return process.env.DICE_MIGRATIONS_DIR
  return resolve(dirname(fileURLToPath(import.meta.url)), 'migrations')
}

// Idempotent — applies only pending migrations. Safe to call on every startup,
// so a fresh install self-initializes its database.
export function runMigrations(): void {
  migrate(db, { migrationsFolder: migrationsDir() })
}
