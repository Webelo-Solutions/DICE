import { buildApp } from './app'
import { runMigrations } from './db/run-migrations'

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '127.0.0.1'

// Self-initialize the database: apply any pending migrations before serving.
// A fresh install thus creates its schema automatically on first launch.
runMigrations()

const app = buildApp()

app.listen({ port, host }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
