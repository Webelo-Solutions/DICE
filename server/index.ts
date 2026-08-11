import { buildApp } from './app'
import { runMigrations } from './db/run-migrations'
import { seedInjectsCatalogIfEmpty } from './db/seed-injects-catalog'

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '127.0.0.1'

// Self-initialize the database: apply any pending migrations before serving.
// A fresh install thus creates its schema automatically on first launch.
runMigrations()
// Only inserts when the catalog is empty — safe on every subsequent boot.
seedInjectsCatalogIfEmpty()

const app = buildApp()

app.listen({ port, host }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
