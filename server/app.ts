import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import fastifyWebsocket from '@fastify/websocket'
import fastifyHelmet from '@fastify/helmet'
import fastifyRateLimit from '@fastify/rate-limit'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { apiRoutes } from './routes'
import { roomRoutes } from './rooms-routes'
import { authRoutes, setupAuthDecorators } from './auth/routes'
import { adminRoutes } from './auth/admin-routes'

const here = dirname(fileURLToPath(import.meta.url))
const DIST_DIR = resolve(here, '../dist')

export function buildApp() {
  const app = Fastify({ logger: true })

  // Treat an empty application/json body as `undefined` instead of throwing
  // FST_ERR_CTP_EMPTY_JSON_BODY. Idiomatic clients send POST .../logout with
  // an empty body + a JSON content-type; the default Fastify parser rejects
  // that with a 400 even though it's a perfectly valid request. Every existing
  // handler already does optional-chained access on req.body, so `undefined`
  // there is fine.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const text = (body as string | Buffer).toString()
    if (text.trim() === '') return done(null, undefined)
    try { done(null, JSON.parse(text)) }
    catch (e) { done(e as Error, undefined) }
  })

  // ── Security headers + Content-Security-Policy (M5) ───────────────────────
  // The app has no inline scripts and never injects HTML (React escapes all
  // output), so script-src can be locked to 'self'. Inline style attributes and
  // Google Fonts require the style/font allowances; solo mode still calls the
  // LLM providers from the browser, so connect-src permits those.
  app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc:    ["'self'"],
        scriptSrc:     ["'self'"],
        styleSrc:      ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc:       ["'self'", 'https://fonts.gstatic.com'],
        imgSrc:        ["'self'", 'data:'],
        connectSrc:    ["'self'", 'https://api.anthropic.com', 'https://api.openai.com', 'https://*.openai.azure.com', 'https://generativelanguage.googleapis.com'],
        objectSrc:     ["'none'"],
        baseUri:       ["'self'"],
        frameAncestors:["'none'"],
        formAction:    ["'self'"],
      },
    },
    // Embedder policy can break cross-origin font/resource loads; not needed here.
    crossOriginEmbedderPolicy: false,
  })

  // Blunt brute-forcing of room codes / facilitator passphrases. Generous enough
  // not to interfere with normal play (per-turn DM calls, session syncs).
  app.register(fastifyRateLimit, { max: 300, timeWindow: '1 minute' })

  // API under /api. Same-origin in production (static served below) and via the
  // Vite dev proxy in development, so no permissive CORS headers are emitted —
  // cross-origin requests are blocked by the browser's same-origin policy.
  app.register(fastifyWebsocket)

  // Wire `req.user` + `app.requireAuth` on the ROOT scope before any plugin
  // registers — Fastify plugins are encapsulated by default, so decorators set
  // inside a plugin aren't visible to sibling plugins. Doing it here makes
  // requireAuth available to every subsequently-registered route plugin.
  setupAuthDecorators(app)

  app.register(authRoutes,  { prefix: '/api' })
  app.register(adminRoutes, { prefix: '/api' })
  app.register(apiRoutes,   { prefix: '/api' })
  app.register(roomRoutes,  { prefix: '/api' })

  // Serve the built SPA when a production build exists. In dev, Vite serves the
  // frontend and proxies /api here, so this block is skipped.
  if (existsSync(DIST_DIR)) {
    app.register(fastifyStatic, { root: DIST_DIR })

    // SPA fallback: any non-API GET that isn't a real file returns index.html
    // so client-side routes (e.g. /scenarios, /game) resolve.
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api')) {
        return reply.sendFile('index.html')
      }
      return reply.code(404).send({ error: 'Not found' })
    })
  }

  return app
}
