// Phase 0 of internal multi-user auth — see the plan in
// C:\Users\Webelo Solutions\.claude\plans\sunny-drifting-pascal.md
//
// This file is the server-side foundation: endpoints + a `requireAuth` Fastify
// decorator. The decorator is REGISTERED but not yet attached to existing data
// routes — Phase 2 wires it through them once UI lands in Phase 1. That keeps
// existing clients working during the transition.
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { repository } from '../db/sqlite-repository'
import { hashPassphrase, verifyPassphrase, newToken, hashToken, USERNAME_RE, MIN_PW_LEN, MAX_PW_LEN, REGISTRATION_CODE_KEY } from './tokens'
import { lockedUntil, recordFailure, recordSuccess } from './lockout'
import type { UserRow } from '../db/repository'

// 30-day rolling sessions. lastSeenAt is bumped on each authenticated request,
// expiresAt is fixed at issue time.
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000

// What we surface to the client about the current user. Never include password
// hash, never include the bearer token after login (client already has it).
export interface AuthUserPublic {
  id:          string
  username:    string
  displayName: string
  role:        string
}

function publicUser(u: UserRow): AuthUserPublic {
  return { id: u.id, username: u.username, displayName: u.displayName, role: u.role }
}

function bearerFrom(authHeader: string | undefined): string | null {
  if (!authHeader) return null
  const m = /^Bearer\s+(.+)$/i.exec(authHeader)
  return m ? m[1].trim() : null
}

// Resolves the user behind a bearer token, or null if none. Touches lastSeenAt
// on success (rolling expiry). Centralized so /me and requireAuth share logic.
function resolveAuth(token: string | null): UserRow | null {
  if (!token) return null
  const session = repository.getAuthSessionByTokenHash(hashToken(token))
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    // Clean up expired tokens lazily so the table doesn't grow forever.
    repository.deleteAuthSession(session.tokenHash)
    return null
  }
  const user = repository.getUserById(session.userId)
  if (!user || !user.active) return null
  repository.touchAuthSession(session.tokenHash, Date.now())
  return user
}

// Attach the current user to the request for downstream handlers (Phase 2).
// `optional`: if true, missing/invalid auth passes through with `req.user = null`.
// If false (default), missing/invalid auth produces a 401.
declare module 'fastify' {
  interface FastifyRequest {
    user: UserRow | null
  }
  interface FastifyInstance {
    requireAuth:  (req: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

interface SetupBody          { username?: string; displayName?: string; password?: string }
interface LoginBody          { username?: string; password?: string }
interface ChangePasswordBody { currentPassword?: string; newPassword?: string }
interface RegisterBody       { username?: string; displayName?: string; password?: string; inviteCode?: string }

// Called from server/app.ts at the ROOT scope BEFORE any plugin registers.
// Fastify plugins are encapsulated by default — decorators set inside a plugin
// aren't visible to sibling plugins. By calling this directly on the root app
// instance, `req.user` and `app.requireAuth` are available everywhere.
export function setupAuthDecorators(app: FastifyInstance) {
  app.decorateRequest('user', null)
  app.decorate('requireAuth', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = resolveAuth(bearerFrom(req.headers.authorization))
    if (!user) return reply.code(401).send({ error: 'authentication required' })
    req.user = user
  })
  // Same as requireAuth, then a role check. 403 (not 401) for non-admins so
  // the client can distinguish "log in" vs "you don't have permission."
  app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = resolveAuth(bearerFrom(req.headers.authorization))
    if (!user) return reply.code(401).send({ error: 'authentication required' })
    if (user.role !== 'admin') return reply.code(403).send({ error: 'admin role required' })
    req.user = user
  })
}

export async function authRoutes(app: FastifyInstance) {

  // ── First-run admin creation ────────────────────────────────────────────--
  // Only callable while the users table is empty. On success: creates the
  // admin, backfills owner_user_id on all existing rows (so the original
  // user's data isn't orphaned), and issues a session token.
  app.post<{ Body: SetupBody }>('/auth/setup', async (req, reply) => {
    if (repository.countUsers() > 0) {
      return reply.code(403).send({ error: 'setup already completed' })
    }
    const { username, displayName, password } = req.body ?? {}
    if (!username || !USERNAME_RE.test(username)) {
      return reply.code(400).send({ error: 'invalid username (alphanumerics, ._- only, 2–32 chars)' })
    }
    if (!displayName || displayName.length < 1 || displayName.length > 64) {
      return reply.code(400).send({ error: 'display name required (1–64 chars)' })
    }
    if (!password || password.length < MIN_PW_LEN || password.length > MAX_PW_LEN) {
      return reply.code(400).send({ error: `password must be ${MIN_PW_LEN}–${MAX_PW_LEN} characters` })
    }

    const now = Date.now()
    const id  = randomUUID()
    repository.createUser({
      id,
      username:     username.toLowerCase(),
      displayName,
      passwordHash: hashPassphrase(password),
      role:         'admin',
      active:       true,
      createdAt:    now,
      lastLoginAt:  now,
    })
    repository.claimUnownedRowsForUser(id)

    const token = newToken()
    repository.createAuthSession({
      tokenHash:  hashToken(token),
      userId:     id,
      createdAt:  now,
      lastSeenAt: now,
      expiresAt:  now + SESSION_LIFETIME_MS,
      userAgent:  req.headers['user-agent']?.toString() ?? null,
    })

    return { token, user: publicUser({
      id, username: username.toLowerCase(), displayName,
      passwordHash: '', role: 'admin', active: true, createdAt: now, lastLoginAt: now,
    } as UserRow) }
  })

  // ── Self-service registration ───────────────────────────────────────────--
  // Off by default — only live once an admin sets an invite code via
  // PUT /admin/registration-code (see admin-routes.ts). Always creates a
  // 'player' (never admin); rate-limited like login to slow invite-code
  // guessing since the code is a shared secret handed to a whole cohort.
  app.post<{ Body: RegisterBody }>('/auth/register', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const registrationCode = repository.getKv<string>(REGISTRATION_CODE_KEY)
    if (!registrationCode) {
      return reply.code(403).send({ error: 'self-registration is disabled on this install' })
    }
    const { username, displayName, password, inviteCode } = req.body ?? {}
    if (inviteCode !== registrationCode) {
      return reply.code(401).send({ error: 'invalid invite code' })
    }
    if (!username || !USERNAME_RE.test(username)) {
      return reply.code(400).send({ error: 'invalid username (alphanumerics, ._- only, 2–32 chars)' })
    }
    if (!displayName || displayName.length < 1 || displayName.length > 64) {
      return reply.code(400).send({ error: 'display name required (1–64 chars)' })
    }
    if (!password || password.length < MIN_PW_LEN || password.length > MAX_PW_LEN) {
      return reply.code(400).send({ error: `password must be ${MIN_PW_LEN}–${MAX_PW_LEN} characters` })
    }
    const lower = username.toLowerCase()
    if (repository.getUserByUsername(lower)) {
      return reply.code(409).send({ error: 'username already exists' })
    }

    const now = Date.now()
    const id  = randomUUID()
    repository.createUser({
      id, username: lower, displayName,
      passwordHash: hashPassphrase(password),
      role:         'player',
      active:       true,
      createdAt:    now,
      lastLoginAt:  now,
    })
    const token = newToken()
    repository.createAuthSession({
      tokenHash:  hashToken(token),
      userId:     id,
      createdAt:  now,
      lastSeenAt: now,
      expiresAt:  now + SESSION_LIFETIME_MS,
      userAgent:  req.headers['user-agent']?.toString() ?? null,
    })
    return reply.code(201).send({ token, user: publicUser({
      id, username: lower, displayName,
      passwordHash: '', role: 'player', active: true, createdAt: now, lastLoginAt: now,
    } as UserRow) })
  })

  // ── Login ───────────────────────────────────────────────────────────────--
  // Stricter rate limit than the global cap to slow brute force. The global
  // 300/min still applies on top.
  app.post<{ Body: LoginBody }>('/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const { username, password } = req.body ?? {}
    if (!username || !password) {
      return reply.code(400).send({ error: 'username and password required' })
    }
    const lower   = username.toLowerCase()
    const lockExp = lockedUntil(lower)
    if (lockExp !== null) {
      const minutes = Math.ceil((lockExp - Date.now()) / 60_000)
      return reply.code(423).send({
        error: `account locked due to repeated failed logins; try again in ${minutes} minute${minutes === 1 ? '' : 's'}`,
        retryAfterMs: lockExp - Date.now(),
      })
    }
    const user = repository.getUserByUsername(lower)
    // Constant-ish branching: still call the hash function on a dummy if user
    // is absent, to keep timing roughly uniform.
    const stored = user?.passwordHash ?? hashPassphrase('__no_user__')
    const ok = verifyPassphrase(password, stored)
    if (!user || !user.active || !ok) {
      recordFailure(lower)
      return reply.code(401).send({ error: 'invalid credentials' })
    }
    recordSuccess(lower)

    const now = Date.now()
    repository.updateUserLastLogin(user.id, now)
    const token = newToken()
    repository.createAuthSession({
      tokenHash:  hashToken(token),
      userId:     user.id,
      createdAt:  now,
      lastSeenAt: now,
      expiresAt:  now + SESSION_LIFETIME_MS,
      userAgent:  req.headers['user-agent']?.toString() ?? null,
    })
    return { token, user: publicUser(user) }
  })

  // ── Logout ──────────────────────────────────────────────────────────────--
  app.post('/auth/logout', async (req, reply) => {
    const token = bearerFrom(req.headers.authorization)
    if (token) repository.deleteAuthSession(hashToken(token))
    return reply.send({ ok: true })
  })

  // ── Change own password ─────────────────────────────────────────────────--
  // Self-service: verify the user's CURRENT password before writing the new
  // hash. On success, revoke every OTHER active session for this user so a
  // compromised device that knew the old password can't keep using its token.
  // The current request's token is preserved — the user stays signed in here.
  app.post<{ Body: ChangePasswordBody }>('/auth/change-password', {
    preHandler: app.requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
  }, async (req, reply) => {
    const user = req.user!
    const { currentPassword, newPassword } = req.body ?? {}
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ error: 'current and new password required' })
    }
    if (newPassword.length < MIN_PW_LEN || newPassword.length > MAX_PW_LEN) {
      return reply.code(400).send({ error: `password must be ${MIN_PW_LEN}–${MAX_PW_LEN} characters` })
    }
    if (!verifyPassphrase(currentPassword, user.passwordHash)) {
      return reply.code(401).send({ error: 'current password is incorrect' })
    }
    if (currentPassword === newPassword) {
      return reply.code(400).send({ error: 'new password must differ from current password' })
    }
    repository.setUserPassword(user.id, hashPassphrase(newPassword))
    // Revoke other sessions but keep the current one.
    const currentToken = bearerFrom(req.headers.authorization)
    if (currentToken) {
      repository.deleteAuthSessionsForUserExcept(user.id, hashToken(currentToken))
    }
    return { ok: true }
  })

  // ── Current user (or "setup required") ──────────────────────────────────--
  // The client polls this on startup to decide between three states:
  //   - setupRequired: true   → render the first-run setup wizard
  //   - authenticated: true   → user object available
  //   - authenticated: false  → show the login page
  app.get('/auth/me', async (req) => {
    const setupRequired = repository.countUsers() === 0
    if (setupRequired) return { authenticated: false, setupRequired: true }
    const user = resolveAuth(bearerFrom(req.headers.authorization))
    if (!user) return { authenticated: false, setupRequired: false }
    return { authenticated: true, setupRequired: false, user: publicUser(user) }
  })
}
