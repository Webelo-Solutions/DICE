import { buildApp } from './app'
import { runMigrations } from './db/run-migrations'
import { seedInjectsCatalogIfEmpty } from './db/seed-injects-catalog'
import { seedSampleCampaignIfEmpty } from './db/seed-sample-campaign'

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '127.0.0.1'

// Self-initialize the database: apply any pending migrations before serving.
// A fresh install thus creates its schema automatically on first launch.
runMigrations()
// Only inserts when the catalog is empty — safe on every subsequent boot.
seedInjectsCatalogIfEmpty()
// Only inserts for an existing admin with zero campaigns — safe on every
// subsequent boot. Brand-new installs are covered separately at first-run
// setup (see seedSampleCampaignForNewAdmin in server/auth/routes.ts).
seedSampleCampaignIfEmpty()

const app = buildApp()

app.listen({ port, host }).then(() => {
  // Plain console line (not the JSON pino log above it) so the mode is
  // obvious at a glance in the "DICE Server" console window — this is
  // the only place a host confirms whether LAN hosting actually took.
  const mode = host === '127.0.0.1' ? 'local only — not reachable from other devices' : 'LAN mode'
  console.log(`[DICE] Listening on ${host}:${port} — ${mode}`)
}).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
