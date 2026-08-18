import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as schema from './schema'

// DB file location: DICE_DB_PATH env (a filesystem path) or a default under
// ./data. A dedicated var (not the generic DATABASE_URL, which is conventionally
// a connection URL and may be set for other services) keeps this unambiguous.
//
// BACKUP: this is NOT a single file while the server is running. WAL mode is
// enabled below, so committed-but-uncheckpointed data lives in a sibling
// `<db>-wal` — which routinely holds far more than the .db itself. Copying the
// .db alone from a live install silently yields a stale database that still
// opens cleanly, which is the worst possible failure shape. Either stop the
// server first, or copy `<db>`, `<db>-wal` and `<db>-shm` together.
const DEFAULT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../data/dice.db')
const dbPath = process.env.DICE_DB_PATH ?? DEFAULT_PATH

mkdirSync(dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)

// WAL mode: many concurrent readers + one writer without blocking. The right
// default for the app's low-write, facilitator-led workload.
sqlite.pragma('journal_mode = WAL')
// Enforce foreign keys and a sane busy timeout so brief write contention waits
// rather than erroring.
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('busy_timeout = 5000')

export const db = drizzle(sqlite, { schema })
export { sqlite }
export type DrizzleDb = typeof db
