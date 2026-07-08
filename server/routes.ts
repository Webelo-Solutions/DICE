import type { FastifyInstance } from 'fastify'
import { repository } from './db/sqlite-repository'
import type { Character } from '../src/types/game'
import type { Campaign, CustomScenario, SaveSlot } from '../src/types/campaign'
import type { SessionRecord } from '../src/types/history'
import type { OrgState } from '../src/types/orgState'
import type { OrgProfile } from '../src/types/orgProfile'
import { validateDicepack } from '../src/content/dicepackSchema'
import type { ContentPackRow } from './db/repository'

interface IdParam { id: string }
interface KeyParam { key: string }

// Pack files can carry base64 headshots; allow well above the default 1 MB.
const PACK_IMPORT_BODY_LIMIT = 12 * 1024 * 1024

// Listing payload omits the heavy `data` snapshot (kept server-side for re-enable).
function packSummary(row: ContentPackRow) {
  return {
    id: row.id, name: row.name, version: row.version, author: row.author,
    enabled: row.enabled, scenarioCount: row.scenarioCount,
    characterCount: row.characterCount, installedAt: row.installedAt,
  }
}

// All routes are registered under the /api prefix (see app.ts). Bodies are the
// full typed entities, matching how the client already models them.
//
// Phase 2 — auth: every data route requires authentication via the
// `app.requireAuth` preHandler. Data routes are scoped by user via req.user.id;
// install-wide routes (content packs, library, org state/profile) still require
// auth but don't filter. /api/kv/:key namespaces the key by user so live
// session state (session/feed/result) is per-user without changing the client
// URL. /api/health stays unauthenticated for uptime probes.
export async function apiRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok' }))

  // Bundled preHandler — short-circuits with 401 if no valid session.
  const auth = { preHandler: app.requireAuth }
  // The non-null assertion is safe: requireAuth has already returned 401 if
  // req.user is null, so any code that reaches a handler has a user.
  const uid = (req: { user: { id: string } | null }) => req.user!.id

  // ── Roster (user-scoped) ────────────────────────────────
  app.get('/characters', auth, async (req) => repository.listCharacters(uid(req)))
  // Pack-imported characters (the library) — install-wide; just requires auth.
  app.get('/library-characters', auth, async () => repository.listLibraryCharacters())
  app.put<{ Params: IdParam; Body: Character }>('/characters/:id', auth, async (req, reply) => {
    if (!req.body?.id) return reply.code(400).send({ error: 'character requires an id' })
    repository.upsertCharacter(req.body, uid(req))
    return req.body
  })
  app.delete<{ Params: IdParam }>('/characters/:id', auth, async (req) => {
    repository.deleteCharacter(req.params.id, uid(req))
    return { deleted: req.params.id }
  })

  // ── Campaigns (user-scoped) ─────────────────────────────
  app.get('/campaigns', auth, async (req) => repository.listCampaigns(uid(req)))
  app.put<{ Params: IdParam; Body: Campaign }>('/campaigns/:id', auth, async (req, reply) => {
    if (!req.body?.id) return reply.code(400).send({ error: 'campaign requires an id' })
    repository.upsertCampaign(req.body, uid(req))
    return req.body
  })
  app.delete<{ Params: IdParam }>('/campaigns/:id', auth, async (req) => {
    repository.deleteCampaign(req.params.id, uid(req))
    return { deleted: req.params.id }
  })

  // ── Custom scenarios (user-scoped; pack content is shared across users) ──
  app.get('/custom-scenarios', auth, async (req) => repository.listCustomScenarios(uid(req)))
  app.put<{ Params: IdParam; Body: CustomScenario }>('/custom-scenarios/:id', auth, async (req, reply) => {
    if (!req.body?.id) return reply.code(400).send({ error: 'scenario requires an id' })
    repository.upsertCustomScenario(req.body, uid(req))
    return req.body
  })
  app.delete<{ Params: IdParam }>('/custom-scenarios/:id', auth, async (req) => {
    repository.deleteCustomScenario(req.params.id, uid(req))
    return { deleted: req.params.id }
  })

  // ── Content packs — install-wide, auth-required ─────────
  app.get('/content-packs', auth, async () => repository.listContentPacks().map(packSummary))
  app.post('/content-packs/import', { ...auth, bodyLimit: PACK_IMPORT_BODY_LIMIT }, async (req, reply) => {
    const result = validateDicepack(req.body)
    if (!result.ok) {
      return reply.code(400).send({ error: 'Invalid content pack', details: result.errors })
    }
    const row = repository.installContentPack(result.pack)
    return packSummary(row)
  })
  app.patch<{ Params: IdParam; Body: { enabled?: boolean } }>('/content-packs/:id', auth, async (req, reply) => {
    if (typeof req.body?.enabled !== 'boolean') {
      return reply.code(400).send({ error: 'body requires { enabled: boolean }' })
    }
    repository.setContentPackEnabled(req.params.id, req.body.enabled)
    return { id: req.params.id, enabled: req.body.enabled }
  })
  app.delete<{ Params: IdParam }>('/content-packs/:id', auth, async (req) => {
    repository.uninstallContentPack(req.params.id)
    return { deleted: req.params.id }
  })

  // ── Save slots (user-scoped) ────────────────────────────
  app.get('/saves', auth, async (req) => repository.listSaves(uid(req)))
  app.post<{ Body: SaveSlot }>('/saves', auth, async (req, reply) => {
    if (!req.body?.id) return reply.code(400).send({ error: 'save requires an id' })
    repository.addSave(req.body, uid(req))
    return req.body
  })
  app.delete<{ Params: IdParam }>('/saves/:id', auth, async (req) => {
    repository.deleteSave(req.params.id, uid(req))
    return { deleted: req.params.id }
  })

  // ── Session history (user-scoped) ───────────────────────
  app.get('/session-history', auth, async (req) => repository.listSessionHistory(uid(req)))
  app.post<{ Body: SessionRecord }>('/session-history', auth, async (req, reply) => {
    if (!req.body?.id) return reply.code(400).send({ error: 'session record requires an id' })
    repository.recordSession(req.body, uid(req))
    return req.body
  })
  app.delete('/session-history', auth, async (req) => {
    repository.clearSessionHistory(uid(req))
    return { cleared: true }
  })

  // ── Org state / profile — install-wide ──────────────────
  app.get('/org-state', auth, async () => repository.getOrgState())
  app.put<{ Body: OrgState }>('/org-state', auth, async (req, reply) => {
    if (!req.body) return reply.code(400).send({ error: 'org state body required' })
    repository.setOrgState(req.body)
    return req.body
  })
  app.get('/org-profile', auth, async () => repository.getActiveOrgProfile())
  app.put<{ Body: OrgProfile | null }>('/org-profile', auth, async (req) => {
    repository.setActiveOrgProfile(req.body ?? null)
    return req.body ?? null
  })

  // ── Generic key/value (current session, feed, result, comm config) ──
  // Keys are user-namespaced so each user has independent live state on the
  // same install. The client URL is unchanged (/api/kv/session) — the server
  // transparently prepends `user:<userId>:` to the storage key.
  const userKv = (req: { user: { id: string } | null; params: { key: string } }) =>
    `user:${req.user!.id}:${req.params.key}`
  app.get<{ Params: KeyParam }>('/kv/:key', auth, async (req) => repository.getKv(userKv(req)))
  app.put<{ Params: KeyParam }>('/kv/:key', auth, async (req) => {
    repository.setKv(userKv(req), req.body)
    return req.body
  })
  app.delete<{ Params: KeyParam }>('/kv/:key', auth, async (req) => {
    repository.deleteKv(userKv(req))
    return { deleted: req.params.key }
  })
}
