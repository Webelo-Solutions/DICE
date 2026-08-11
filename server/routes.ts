import type { FastifyInstance } from 'fastify'
import { networkInterfaces } from 'node:os'
import { repository } from './db/sqlite-repository'
import type { Character } from '../src/types/game'
import type { Campaign, CustomScenario, SaveSlot } from '../src/types/campaign'
import type { SessionRecord } from '../src/types/history'
import type { OrgState } from '../src/types/orgState'
import type { OrgProfile } from '../src/types/orgProfile'
import { validateDicepack } from '../src/content/dicepackSchema'
import type { ContentPackRow } from './db/repository'
import { renderSessionReportPdf } from './reports/sessionReportPdf'
import { toCsv } from './reports/csv'

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

  // Unauthenticated, like /health — lets the Lobby build a shareable join link
  // (link + QR) without the facilitator having to run `ipconfig` themselves.
  // Only surfaces non-internal IPv4s; a host on multiple networks (e.g. Wi-Fi +
  // a VPN adapter) gets every candidate back and the client picks the first.
  app.get('/network-info', async () => ({
    port: Number(process.env.PORT ?? 3001),
    addresses: Object.values(networkInterfaces())
      .flatMap((iface) => iface ?? [])
      .filter((i) => i.family === 'IPv4' && !i.internal)
      .map((i) => i.address),
  }))

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

  // ── Injects catalog — install-wide, auth-required ───────
  // Read-only here; management is admin-gated (see server/auth/admin-routes.ts).
  app.get('/injects-catalog', auth, async () => repository.listInjectsCatalog())

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

  // Single-record report/export — scoped to the record's own owner, OR an
  // admin (so admins can pull any team member's report for compliance
  // evidence without needing that member's credentials).
  const canReadRecord = (req: { user: { id: string; role: string } | null }, ownerUserId: string | null) =>
    ownerUserId === req.user!.id || req.user!.role === 'admin'

  app.get<{ Params: IdParam }>('/session-history/:id/report.pdf', auth, async (req, reply) => {
    const record = repository.getSessionHistoryById(req.params.id)
    if (!record) return reply.code(404).send({ error: 'session record not found' })
    if (!canReadRecord(req, record.ownerUserId)) return reply.code(403).send({ error: 'not your session record' })
    const owner = record.ownerUserId ? repository.getUserById(record.ownerUserId) : null
    const pdf = await renderSessionReportPdf(record, owner?.displayName ?? 'Unknown user')
    reply.type('application/pdf')
    reply.header('Content-Disposition', `attachment; filename="DICE-Report-${record.scenarioId}-${record.id.slice(0, 8)}.pdf"`)
    return reply.send(pdf)
  })

  app.get<{ Params: IdParam }>('/session-history/:id/export.json', auth, async (req, reply) => {
    const record = repository.getSessionHistoryById(req.params.id)
    if (!record) return reply.code(404).send({ error: 'session record not found' })
    if (!canReadRecord(req, record.ownerUserId)) return reply.code(403).send({ error: 'not your session record' })
    reply.type('application/json')
    reply.header('Content-Disposition', `attachment; filename="DICE-Session-${record.scenarioId}-${record.id.slice(0, 8)}.json"`)
    return reply.send(JSON.stringify(record, null, 2))
  })

  // Bulk CSV of the caller's OWN session history (summary rows, one per
  // session) — for feeding into a spreadsheet, GRC tool, or ticketing system.
  app.get('/session-history/export.csv', auth, async (req, reply) => {
    const records = repository.listSessionHistory(uid(req))
    const csv = toCsv(
      ['id', 'scenarioId', 'scenarioTitle', 'difficulty', 'outcome', 'playerCount', 'players', 'roundsPlayed', 'xpAwarded', 'criticalHits', 'criticalFails', 'playedAt'],
      records.map((r) => [
        r.id, r.scenarioId, r.scenarioTitle, r.difficulty, r.outcome, r.playerCount,
        r.players.map((p) => p.name).join('; '), r.result.roundsPlayed, r.result.xpAwarded,
        r.result.criticalHits, r.result.criticalFails, new Date(r.playedAt).toISOString(),
      ]),
    )
    reply.type('text/csv')
    reply.header('Content-Disposition', 'attachment; filename="DICE-Session-History.csv"')
    return reply.send(csv)
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
