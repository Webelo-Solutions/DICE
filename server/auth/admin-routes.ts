// Admin user-management endpoints — Phase 3 of internal multi-user auth.
//
// Every route here is gated by `requireAdmin`. Self-protect guards prevent an
// admin from locking themselves out (can't disable, demote, or reset-pw their
// own account via this surface — they sign out and log in normally, or use the
// account self-service page).
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { repository } from '../db/sqlite-repository'
import { hashPassphrase, USERNAME_RE, MIN_PW_LEN, MAX_PW_LEN, REGISTRATION_CODE_KEY } from './tokens'
import type { UserRow } from '../db/repository'
import { toCsv } from '../reports/csv'
import { CriticalInjectCatalogEntrySchema, ScenarioSchema } from '../../src/content/dicepackSchema'
import type { CustomScenario } from '../../src/types/campaign'

const VALID_ROLES = new Set(['admin', 'player'])
const MIN_CODE_LEN = 4
const MAX_CODE_LEN = 64

// Compliance-cadence: how often the program expects each user to run an
// exercise. Stored install-wide in kv_state, like the registration code.
// Default 90 days (quarterly) — a common baseline for periodic IR testing
// requirements (PCI-DSS, SOC 2, ISO 27001, NIST CSF all expect *some* cadence,
// though none of them mandate this specific number).
const CADENCE_DAYS_KEY = 'exerciseCadenceDays'
const DEFAULT_CADENCE_DAYS = 90

// The organisation named as the activity sponsor on a CPE certificate. ISC²
// expects a certificate to say who ran the training, and "DICE" is the tool
// rather than the provider, so this is set per install and falls back to a
// label that is obviously a placeholder instead of quietly looking official.
const CPE_PROVIDER_KEY = 'cpeProviderName'
const DEFAULT_CPE_PROVIDER = 'Unnamed organization'
const MAX_CPE_PROVIDER_LENGTH = 120
const MIN_CADENCE_DAYS = 1
const MAX_CADENCE_DAYS = 3650

// Sanitized projection for any admin response — strips the password hash.
function userPublic(u: UserRow) {
  return {
    id:          u.id,
    username:    u.username,
    displayName: u.displayName,
    role:        u.role,
    active:      u.active,
    createdAt:   u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }
}

interface IdParam { id: string }
interface CreateUserBody { username?: string; displayName?: string; password?: string; role?: string }
interface UpdateUserBody { displayName?: string; role?: string; active?: boolean }
interface PasswordBody   { password?: string }
interface RegistrationCodeBody { code?: string | null }

export async function adminRoutes(app: FastifyInstance) {
  const admin = { preHandler: app.requireAdmin }

  // List users
  app.get('/admin/users', admin, async () => {
    return repository.listUsers().map(userPublic)
  })

  // Create user
  app.post<{ Body: CreateUserBody }>('/admin/users', admin, async (req, reply) => {
    const { username, displayName, password, role } = req.body ?? {}
    if (!username || !USERNAME_RE.test(username)) {
      return reply.code(400).send({ error: 'invalid username (alphanumerics, ._- only, 2–32 chars)' })
    }
    if (!displayName || displayName.length < 1 || displayName.length > 64) {
      return reply.code(400).send({ error: 'display name required (1–64 chars)' })
    }
    if (!password || password.length < MIN_PW_LEN || password.length > MAX_PW_LEN) {
      return reply.code(400).send({ error: `password must be ${MIN_PW_LEN}–${MAX_PW_LEN} characters` })
    }
    const finalRole = role && VALID_ROLES.has(role) ? role : 'player'

    const lower = username.toLowerCase()
    if (repository.getUserByUsername(lower)) {
      return reply.code(409).send({ error: 'username already exists' })
    }

    const id = randomUUID()
    repository.createUser({
      id, username: lower, displayName,
      passwordHash: hashPassphrase(password),
      role: finalRole, active: true, createdAt: Date.now(),
    })
    const created = repository.getUserById(id)!
    return reply.code(201).send(userPublic(created))
  })

  // Update user (display name, role, active flag).
  // Self-protect: an admin cannot demote or deactivate themselves via this route.
  app.patch<{ Params: IdParam; Body: UpdateUserBody }>('/admin/users/:id', admin, async (req, reply) => {
    const target = repository.getUserById(req.params.id)
    if (!target) return reply.code(404).send({ error: 'user not found' })
    const self = req.user!.id === target.id

    const { displayName, role, active } = req.body ?? {}

    if (displayName !== undefined) {
      if (displayName.length < 1 || displayName.length > 64) {
        return reply.code(400).send({ error: 'display name must be 1–64 chars' })
      }
    }
    if (role !== undefined) {
      if (!VALID_ROLES.has(role)) return reply.code(400).send({ error: 'invalid role' })
      if (self && role !== 'admin') return reply.code(400).send({ error: 'cannot demote yourself' })
    }
    if (active !== undefined) {
      if (typeof active !== 'boolean') return reply.code(400).send({ error: 'active must be boolean' })
      if (self && active === false) return reply.code(400).send({ error: 'cannot deactivate yourself' })
    }

    // Apply patches one column at a time — repo's only generic updater is the
    // role/active/displayName-aware setters; do them through small repo calls.
    if (displayName !== undefined && displayName !== target.displayName) {
      repository.setUserDisplayName(target.id, displayName)
    }
    if (role !== undefined && role !== target.role) {
      repository.setUserRole(target.id, role)
    }
    if (active !== undefined && active !== target.active) {
      repository.setUserActive(target.id, active)
      // Deactivating kicks all of the user's existing sessions immediately.
      if (!active) repository.deleteAuthSessionsForUser(target.id)
    }

    const after = repository.getUserById(target.id)!
    return userPublic(after)
  })

  // Reset a user's password. Always revokes their existing sessions — a
  // password change implies "kick everyone off." The admin doing this hands the
  // new password to the user via an out-of-band channel.
  app.post<{ Params: IdParam; Body: PasswordBody }>('/admin/users/:id/reset-password', admin, async (req, reply) => {
    const target = repository.getUserById(req.params.id)
    if (!target) return reply.code(404).send({ error: 'user not found' })
    const { password } = req.body ?? {}
    if (!password || password.length < MIN_PW_LEN || password.length > MAX_PW_LEN) {
      return reply.code(400).send({ error: `password must be ${MIN_PW_LEN}–${MAX_PW_LEN} characters` })
    }
    repository.setUserPassword(target.id, hashPassphrase(password))
    // Don't sign the admin out if they're resetting their own pw via this route.
    if (req.user!.id !== target.id) repository.deleteAuthSessionsForUser(target.id)
    return { ok: true }
  })

  // Sign a user out of all their active sessions. Doesn't disable the account —
  // they can log back in with their existing password.
  app.post<{ Params: IdParam }>('/admin/users/:id/sign-out', admin, async (req, reply) => {
    const target = repository.getUserById(req.params.id)
    if (!target) return reply.code(404).send({ error: 'user not found' })
    repository.deleteAuthSessionsForUser(target.id)
    return { ok: true }
  })

  // ── Self-service registration invite code ───────────────────────────────
  // Gates POST /auth/register (routes.ts). No code set = registration disabled
  // (the default). The code is a shared secret handed to a whole cohort, not a
  // per-person credential, so it's stored as plain text (in kv_state) and
  // re-readable here — unlike a password hash, the admin needs to be able to
  // see it again to re-share it.
  app.get('/admin/registration-code', admin, async () => {
    return { code: repository.getKv<string>(REGISTRATION_CODE_KEY) }
  })
  app.put<{ Body: RegistrationCodeBody }>('/admin/registration-code', admin, async (req, reply) => {
    const code = req.body?.code
    if (code === null || code === undefined || code === '') {
      repository.deleteKv(REGISTRATION_CODE_KEY)
      return { code: null }
    }
    if (code.length < MIN_CODE_LEN || code.length > MAX_CODE_LEN) {
      return reply.code(400).send({ error: `invite code must be ${MIN_CODE_LEN}–${MAX_CODE_LEN} characters` })
    }
    repository.setKv(REGISTRATION_CODE_KEY, code)
    return { code }
  })

  // ── Program-wide analytics ───────────────────────────────────────────────
  // Every user's session history, plus the configured exercise cadence — the
  // client reuses the same aggregation utilities (gapAnalysis.ts) that the
  // per-user Analytics page uses, just over the combined record set.
  app.get('/admin/analytics', admin, async () => {
    const cadenceDays = repository.getKv<number>(CADENCE_DAYS_KEY) ?? DEFAULT_CADENCE_DAYS
    const cpeProviderName = repository.getKv<string>(CPE_PROVIDER_KEY) ?? DEFAULT_CPE_PROVIDER
    return { sessions: repository.listAllSessionHistory(), cadenceDays, cpeProviderName }
  })

  // The CPE sponsor name is readable by any signed-in user (a certificate
  // renders it) but writable only by an admin, like every other install-wide
  // setting here.
  app.put<{ Body: { providerName?: string } }>('/admin/cpe/provider', admin, async (req, reply) => {
    const name = (req.body?.providerName ?? '').trim().slice(0, MAX_CPE_PROVIDER_LENGTH)
    if (!name) return reply.code(400).send({ error: 'A provider name is required' })
    repository.setKv(CPE_PROVIDER_KEY, name)
    return { providerName: name }
  })

  app.put<{ Body: { cadenceDays?: number } }>('/admin/analytics/cadence-days', admin, async (req, reply) => {
    const days = req.body?.cadenceDays
    if (typeof days !== 'number' || !Number.isInteger(days) || days < MIN_CADENCE_DAYS || days > MAX_CADENCE_DAYS) {
      return reply.code(400).send({ error: `cadenceDays must be an integer between ${MIN_CADENCE_DAYS} and ${MAX_CADENCE_DAYS}` })
    }
    repository.setKv(CADENCE_DAYS_KEY, days)
    return { cadenceDays: days }
  })

  // ── Injects catalog (management; the plain read route is GET /injects-catalog
  // in server/routes.ts, available to every authenticated user) ─────────────
  app.get('/admin/injects-catalog', admin, async () => repository.listInjectsCatalog())

  app.put<{ Params: IdParam; Body: unknown }>('/admin/injects-catalog/:id', admin, async (req, reply) => {
    const parsed = CriticalInjectCatalogEntrySchema.safeParse({ ...(req.body as object), id: req.params.id })
    if (!parsed.success) return reply.code(400).send({ error: 'invalid inject entry', details: parsed.error.issues })
    repository.upsertInjectCatalogEntry(parsed.data)
    return parsed.data
  })

  app.delete<{ Params: IdParam }>('/admin/injects-catalog/:id', admin, async (req) => {
    repository.deleteInjectCatalogEntry(req.params.id)
    return { deleted: req.params.id }
  })

  // ── Scenarios (full editor, admin-gated) ────────────────────────────────
  // Operates on every custom scenario on the install (not just the caller's
  // own) — always marks the row is_global so it becomes visible to everyone.
  app.get('/admin/scenarios', admin, async () => repository.listAllCustomScenarios())

  app.put<{ Params: IdParam; Body: unknown }>('/admin/scenarios/:id', admin, async (req, reply) => {
    const parsed = ScenarioSchema.safeParse({ ...(req.body as object), id: req.params.id })
    if (!parsed.success) return reply.code(400).send({ error: 'invalid scenario', details: parsed.error.issues })
    const existing = repository.listAllCustomScenarios().find((s) => s.id === req.params.id)
    const now = Date.now()
    const scenario = {
      ...parsed.data, isCustom: true as const, isGlobal: true,
      createdAt: existing?.createdAt ?? now, updatedAt: now,
    } as unknown as CustomScenario
    repository.adminUpsertCustomScenario(scenario)
    return scenario
  })

  app.delete<{ Params: IdParam }>('/admin/scenarios/:id', admin, async (req) => {
    repository.adminDeleteCustomScenario(req.params.id)
    return { deleted: req.params.id }
  })

  // Bulk CSV across EVERY user on the install — the compliance/GRC export.
  app.get('/admin/analytics/export.csv', admin, async (req, reply) => {
    const sessions = repository.listAllSessionHistory()
    const users    = new Map(repository.listUsers().map((u) => [u.id, u]))
    const csv = toCsv(
      ['id', 'user', 'scenarioId', 'scenarioTitle', 'difficulty', 'outcome', 'playerCount', 'players', 'roundsPlayed', 'xpAwarded', 'criticalHits', 'criticalFails', 'playedAt'],
      sessions.map((r) => [
        r.id, r.ownerUserId ? (users.get(r.ownerUserId)?.username ?? r.ownerUserId) : 'unknown',
        r.scenarioId, r.scenarioTitle, r.difficulty, r.outcome, r.playerCount,
        r.players.map((p) => p.name).join('; '), r.result.roundsPlayed, r.result.xpAwarded,
        r.result.criticalHits, r.result.criticalFails, new Date(r.playedAt).toISOString(),
      ]),
    )
    reply.type('text/csv')
    reply.header('Content-Disposition', 'attachment; filename="DICE-Program-Session-History.csv"')
    return reply.send(csv)
  })
}
