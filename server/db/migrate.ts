import { sqlite } from './client'
import { runMigrations, migrationsDir } from './run-migrations'

// Standalone CLI: `npm run db:migrate`. The server also self-migrates on startup
// (see server/index.ts), so this is mainly for dev/explicit runs.
runMigrations()
sqlite.close()
console.log('Migrations applied:', migrationsDir())
