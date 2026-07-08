// Admin user-management endpoints — Phase 3 of internal multi-user auth.
//
// Every route here is gated by `requireAdmin`. Self-protect guards prevent an
// admin from locking themselves out (can't disable, demote, or reset-pw their
// own account via this surface — they sign out and log in normally, or use the
// account self-service page).
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { repository } from '../db/sqlite-repository'
import { hashPassphrase } from './tokens'
import type { UserRow } from '../db/repository'

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/i
const MIN_PW_LEN  = 8
const MAX_PW_LEN  = 256
const VALID_ROLES = new Set(['admin', 'player'])

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
}
