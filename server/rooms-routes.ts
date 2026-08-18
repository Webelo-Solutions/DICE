import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { repository } from './db/sqlite-repository'
import type { RoomRow, ParticipantRow, DepartmentRow } from './db/repository'
import { newToken, hashToken, newRoomCode, hashPassphrase, verifyPassphrase } from './auth/tokens'
import { subscribe, unsubscribe, broadcast, connectedParticipantIds } from './realtime'
import { setRoomProvider, getRoomProvider } from './ai-config'
import { callDM } from '../src/engine/dmClient'
import { levelForXp } from '../src/utils/leveling'
import type { Room, Participant, Department, RoomRole, RoomMode } from '../src/types/room'
import { GAME_ROLES, MAX_DEPARTMENTAL_PARTICIPANTS } from '../src/types/room'
import type { Character, CharacterClass, GameSession } from '../src/types/game'
import type { ProviderConfig } from '../src/types/provider'
import type { OrgState } from '../src/types/orgState'
import type { OrgProfile } from '../src/types/orgProfile'

// Push the current lobby (participant list + departments) to everyone connected
// to the room. Departments ride along on the same message because every view
// that renders the roster groups it by department — sending them separately
// would let a client paint a member into a department it hasn't heard of yet.
function broadcastLobby(roomId: string) {
  const connectedIds = connectedParticipantIds(roomId)
  broadcast(roomId, {
    type: 'lobby',
    participants: repository.listParticipants(roomId).map((p) => toPublicParticipant(p, connectedIds)),
    departments: repository.listDepartments(roomId).map(toPublicDepartment),
    // The room's own mode rides along so a client can never render the wrong
    // lobby off a stale membership — one persisted before departmental mode
    // existed, or one carried through a facilitator handover.
    mode: repository.getRoomById(roomId)?.mode ?? 'standard',
  })
}

// Attach the resolved participant to the request (typed locally to avoid global
// Fastify augmentation).
type AuthedRequest = FastifyRequest & { participant?: ParticipantRow }

function toPublicRoom(r: RoomRow): Room {
  return {
    id: r.id, code: r.code, name: r.name, status: r.status as Room['status'],
    mode: r.mode as RoomMode, createdAt: r.createdAt, updatedAt: r.updatedAt,
  }
}
function toPublicParticipant(p: ParticipantRow, connectedIds: Set<string> = new Set()): Participant {
  return {
    id: p.id, roomId: p.roomId, role: p.role as RoomRole, displayName: p.displayName,
    characterId: p.characterId ?? null, character: (p.character as Character | null) ?? null,
    lastSeenAt: p.lastSeenAt, createdAt: p.createdAt,
    connected: connectedIds.has(p.id),
    gameRole: (p.gameRole as CharacterClass | null) ?? null,
    departmentId: p.departmentId ?? null,
    usesTemplate: p.usesTemplate,
  }
}
function toPublicDepartment(d: DepartmentRow): Department {
  return { id: d.id, roomId: d.roomId, name: d.name, leadParticipantId: d.leadParticipantId ?? null, createdAt: d.createdAt }
}

function isGameRole(value: unknown): value is CharacterClass {
  return typeof value === 'string' && (GAME_ROLES as string[]).includes(value)
}

// Hosts that mean "this machine". Used only to recognise the development setup
// in the WebSocket origin check below.
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

// Strip the port from a Host header, allowing for bracketed IPv6 literals
// ("[::1]:5173" → "::1").
function isLoopbackHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false
  const withoutPort = /^(\[[^\]]+\]|[^:]+)(?::\d+)?$/.exec(hostHeader.trim())?.[1] ?? hostHeader
  return LOOPBACK_HOSTNAMES.has(withoutPort.replace(/^\[|\]$/g, '').toLowerCase())
}

// Resolve the bearer token → participant, or 401. Used as a preHandler.
function authenticate(req: AuthedRequest, reply: FastifyReply): boolean {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) { reply.code(401).send({ error: 'Missing bearer token' }); return false }
  const participant = repository.getParticipantByTokenHash(hashToken(token))
  if (!participant) { reply.code(401).send({ error: 'Invalid token' }); return false }
  repository.touchParticipant(participant.id)
  req.participant = participant
  return true
}

export async function roomRoutes(app: FastifyInstance) {
  // Every DICE page reachable in the browser (including /host, /join) already
  // requires a signed-in account (App.tsx's RequireAuth), so anyone calling
  // these room-membership endpoints is already a real DICE user — auth-gate
  // them the same way the main data routes are (server/routes.ts).
  const auth = { preHandler: app.requireAuth }

  // ── Create a room (become its facilitator) ──────────────
  app.post<{ Body: { name?: string; passphrase?: string; mode?: string; departments?: string[] } }>('/rooms', auth, async (req, reply) => {
    const name = ((req.body?.name ?? '').trim() || 'DICE Session').slice(0, 80)
    const passphrase = req.body?.passphrase ?? ''
    if (passphrase.length < 4) return reply.code(400).send({ error: 'A facilitator passphrase of at least 4 characters is required' })
    if (passphrase.length > 200) return reply.code(400).send({ error: 'Passphrase is too long' })
    const mode: RoomMode = req.body?.mode === 'departmental' ? 'departmental' : 'standard'

    // Generate a unique room code (retry on the rare collision).
    let code = newRoomCode()
    for (let i = 0; i < 5 && repository.getRoomByCode(code); i++) code = newRoomCode()

    const now = Date.now()
    const roomId = randomUUID()
    repository.createRoom({ id: roomId, code, name, facilitatorSecretHash: hashPassphrase(passphrase), status: 'lobby', mode, createdAt: now, updatedAt: now })

    // Departments are picked from a fixed list at join, never free-typed —
    // twenty people typing a name produces phantom departments from typos and
    // casing that then fragment every report. The facilitator seeds the list
    // here and can edit it in the lobby.
    if (mode === 'departmental') {
      for (const raw of req.body?.departments ?? []) {
        const deptName = raw.trim().slice(0, 60)
        if (!deptName) continue
        repository.createDepartment({ id: randomUUID(), roomId, campaignId: null, name: deptName, leadParticipantId: null, createdAt: now })
      }
    }

    const token = newToken()
    const participantId = randomUUID()
    repository.addParticipant({
      id: participantId, roomId, role: 'facilitator', displayName: 'Facilitator',
      characterId: null, character: null, ownerUserId: req.user!.id,
      tokenHash: hashToken(token), lastSeenAt: now, createdAt: now,
    })

    const room = repository.getRoomById(roomId)!
    const participant = repository.getParticipantByTokenHash(hashToken(token))!
    return reply.code(201).send({ room: toPublicRoom(room), participant: toPublicParticipant(participant), token })
  })

  // ── Join a room as a player ─────────────────────────────
  // Players bring one of their own persisted roster characters — so XP/skills
  // earned this session can be written back to it at /rooms/:code/end, rather
  // than starting a throwaway character from scratch every time.
  app.post<{ Params: { code: string }; Body: { characterId?: string; gameRole?: string; departmentId?: string | null; displayName?: string } }>(
    '/rooms/:code/join', auth, async (req, reply) => {
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    if (room.status === 'ended') return reply.code(409).send({ error: 'This room has ended' })

    const characterId = req.body?.characterId
    const character = characterId
      ? repository.listCharacters(req.user!.id).find((c) => c.id === characterId) ?? null
      : null
    if (characterId && !character) return reply.code(404).send({ error: 'Character not found in your roster' })

    // ── Standard rooms keep the original contract: one player, one character.
    if (room.mode !== 'departmental') {
      if (!character) return reply.code(400).send({ error: 'A character is required to join' })
    }

    let gameRole: CharacterClass | null = null
    let departmentId: string | null = null
    let displayName = character?.name ?? ''

    // ── Departmental rooms: the role is what matters, the character is optional.
    if (room.mode === 'departmental') {
      const existing = repository.listParticipants(room.id).filter((p) => p.role !== 'facilitator')
      if (existing.length >= MAX_DEPARTMENTAL_PARTICIPANTS) {
        return reply.code(409).send({ error: `This session is full (${MAX_DEPARTMENTAL_PARTICIPANTS} participants maximum)` })
      }
      if (!isGameRole(req.body?.gameRole)) {
        return reply.code(400).send({ error: 'Pick one of the six roles to join' })
      }
      gameRole = req.body.gameRole

      // A department is optional (decision D2) but, when given, must be one the
      // facilitator actually created in THIS room — otherwise a crafted id could
      // attach a participant to another room's department.
      const wanted = req.body?.departmentId
      if (wanted) {
        const dept = repository.getDepartmentById(wanted)
        if (!dept || dept.roomId !== room.id) return reply.code(400).send({ error: 'That department is not part of this session' })
        departmentId = dept.id
      }

      // Without a character there is no name to inherit, so an explicit one is
      // required — a roster of twenty "Participant" rows helps nobody.
      displayName = (req.body?.displayName ?? character?.name ?? '').trim().slice(0, 40)
      if (!displayName) return reply.code(400).send({ error: 'A display name is required' })
    }

    const now = Date.now()
    const token = newToken()
    const participantId = randomUUID()
    repository.addParticipant({
      id: participantId, roomId: room.id, role: 'player', displayName,
      characterId: character?.id ?? null, character, ownerUserId: req.user!.id,
      tokenHash: hashToken(token), lastSeenAt: now, createdAt: now,
      gameRole, departmentId,
      // No personal character means this seat will act on the role's baseline
      // template sheet, and earns no persisted XP at /end (decision D5).
      usesTemplate: room.mode === 'departmental' && !character,
    })

    const participant = repository.getParticipantByTokenHash(hashToken(token))!
    broadcastLobby(room.id)
    return reply.code(201).send({ room: toPublicRoom(room), participant: toPublicParticipant(participant), token })
  })

  // ── Claim/reclaim facilitator control with the passphrase ──
  app.post<{ Params: { code: string }; Body: { passphrase?: string; displayName?: string } }>('/rooms/:code/claim-facilitator', auth, async (req, reply) => {
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    if (!verifyPassphrase(req.body?.passphrase ?? '', room.facilitatorSecretHash)) {
      return reply.code(403).send({ error: 'Incorrect facilitator passphrase' })
    }
    const now = Date.now()
    const token = newToken()
    const participantId = randomUUID()
    repository.addParticipant({
      id: participantId, roomId: room.id, role: 'facilitator',
      displayName: ((req.body?.displayName ?? 'Facilitator').trim() || 'Facilitator').slice(0, 40),
      characterId: null, character: null, ownerUserId: req.user!.id,
      tokenHash: hashToken(token), lastSeenAt: now, createdAt: now,
    })

    const participant = repository.getParticipantByTokenHash(hashToken(token))!
    broadcastLobby(room.id)
    return reply.send({ room: toPublicRoom(room), participant: toPublicParticipant(participant), token })
  })

  // ── Lobby info (public by code on a trusted LAN) ────────
  app.get<{ Params: { code: string } }>('/rooms/:code', async (req, reply) => {
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    const connectedIds = connectedParticipantIds(room.id)
    return reply.send({
      room: toPublicRoom(room),
      participants: repository.listParticipants(room.id).map((p) => toPublicParticipant(p, connectedIds)),
      departments: repository.listDepartments(room.id).map(toPublicDepartment),
    })
  })

  // ── Departments (facilitator-managed; organisational only — decision D2) ──
  // Resolves the room, authenticates the caller, and confirms they facilitate
  // THIS room. Returns null after replying when any of that fails.
  const requireFacilitatorOf = (req: AuthedRequest, reply: FastifyReply, code: string): RoomRow | null => {
    if (!authenticate(req, reply)) return null
    const room = repository.getRoomByCode(code.toUpperCase())
    if (!room) { reply.code(404).send({ error: 'Room not found' }); return null }
    const me = req.participant!
    if (me.roomId !== room.id) { reply.code(403).send({ error: 'Not a member of this room' }); return null }
    if (me.role !== 'facilitator') { reply.code(403).send({ error: 'Only the facilitator can manage departments' }); return null }
    return room
  }

  app.post<{ Params: { code: string }; Body: { name?: string } }>('/rooms/:code/departments', async (req, reply) => {
    const room = requireFacilitatorOf(req as AuthedRequest, reply, req.params.code)
    if (!room) return
    const name = (req.body?.name ?? '').trim().slice(0, 60)
    if (!name) return reply.code(400).send({ error: 'A department name is required' })
    const existing = repository.listDepartments(room.id)
    if (existing.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      return reply.code(409).send({ error: `A department called "${name}" already exists` })
    }
    repository.createDepartment({ id: randomUUID(), roomId: room.id, campaignId: null, name, leadParticipantId: null, createdAt: Date.now() })
    broadcastLobby(room.id)
    return reply.code(201).send({ departments: repository.listDepartments(room.id).map(toPublicDepartment) })
  })

  app.patch<{ Params: { code: string; id: string }; Body: { name?: string; leadParticipantId?: string | null } }>(
    '/rooms/:code/departments/:id', async (req, reply) => {
      const room = requireFacilitatorOf(req as AuthedRequest, reply, req.params.code)
      if (!room) return
      const dept = repository.getDepartmentById(req.params.id)
      if (!dept || dept.roomId !== room.id) return reply.code(404).send({ error: 'Department not found' })

      const updates: { name?: string; leadParticipantId?: string | null } = {}
      if (typeof req.body?.name === 'string') {
        const name = req.body.name.trim().slice(0, 60)
        if (!name) return reply.code(400).send({ error: 'A department name is required' })
        updates.name = name
      }
      // Promoting a lead is a role change as well as a pointer: the person also
      // becomes dept_lead so they actually gain the powers (decision D8).
      // Demoting the previous lead keeps exactly one lead per department.
      if (req.body?.leadParticipantId !== undefined) {
        const leadId = req.body.leadParticipantId
        if (leadId === null) {
          if (dept.leadParticipantId) repository.updateParticipant(dept.leadParticipantId, { role: 'player' })
          updates.leadParticipantId = null
        } else {
          const lead = repository.getParticipantById(leadId)
          if (!lead || lead.roomId !== room.id) return reply.code(400).send({ error: 'That participant is not in this session' })
          if (lead.departmentId !== dept.id) return reply.code(400).send({ error: 'A department lead must be a member of that department' })
          if (lead.role === 'facilitator') return reply.code(400).send({ error: 'The facilitator cannot also be a department lead' })
          if (dept.leadParticipantId && dept.leadParticipantId !== leadId) {
            repository.updateParticipant(dept.leadParticipantId, { role: 'player' })
          }
          repository.updateParticipant(leadId, { role: 'dept_lead' })
          updates.leadParticipantId = leadId
        }
      }
      repository.updateDepartment(dept.id, updates)
      broadcastLobby(room.id)
      return reply.send({ departments: repository.listDepartments(room.id).map(toPublicDepartment) })
    },
  )

  app.delete<{ Params: { code: string; id: string } }>('/rooms/:code/departments/:id', async (req, reply) => {
    const room = requireFacilitatorOf(req as AuthedRequest, reply, req.params.code)
    if (!room) return
    const dept = repository.getDepartmentById(req.params.id)
    if (!dept || dept.roomId !== room.id) return reply.code(404).send({ error: 'Department not found' })
    // Demote the lead before the row goes — otherwise they keep dept_lead
    // powers over a department that no longer exists.
    if (dept.leadParticipantId) repository.updateParticipant(dept.leadParticipantId, { role: 'player' })
    repository.deleteDepartment(dept.id)
    broadcastLobby(room.id)
    return reply.send({ departments: repository.listDepartments(room.id).map(toPublicDepartment) })
  })

  // ── Facilitator edits a seat: move someone between departments, or fix the
  //    role they picked at join. Cannot touch the facilitator's own row. ──
  app.patch<{ Params: { code: string; id: string }; Body: { gameRole?: string; departmentId?: string | null } }>(
    '/rooms/:code/participants/:id', async (req, reply) => {
      const room = requireFacilitatorOf(req as AuthedRequest, reply, req.params.code)
      if (!room) return
      const target = repository.getParticipantById(req.params.id)
      if (!target || target.roomId !== room.id) return reply.code(404).send({ error: 'Participant not found' })
      if (target.role === 'facilitator') return reply.code(400).send({ error: 'The facilitator does not staff a role' })

      const updates: { gameRole?: string; departmentId?: string | null } = {}
      if (req.body?.gameRole !== undefined) {
        if (!isGameRole(req.body.gameRole)) return reply.code(400).send({ error: 'Unknown role' })
        updates.gameRole = req.body.gameRole
      }
      if (req.body?.departmentId !== undefined) {
        const wanted = req.body.departmentId
        if (wanted === null) {
          updates.departmentId = null
        } else {
          const dept = repository.getDepartmentById(wanted)
          if (!dept || dept.roomId !== room.id) return reply.code(400).send({ error: 'That department is not part of this session' })
          updates.departmentId = dept.id
        }
        // Moving out of the department they lead vacates the lead seat, so the
        // department is never led from outside itself.
        if (updates.departmentId !== target.departmentId && target.role === 'dept_lead') {
          const led = repository.listDepartments(room.id).find((d) => d.leadParticipantId === target.id)
          if (led) repository.updateDepartment(led.id, { leadParticipantId: null })
          repository.updateParticipant(target.id, { role: 'player' })
        }
      }
      repository.updateParticipant(target.id, updates)
      broadcastLobby(room.id)
      const connectedIds = connectedParticipantIds(room.id)
      return reply.send({ participants: repository.listParticipants(room.id).map((p) => toPublicParticipant(p, connectedIds)) })
    },
  )

  // ── Per-room live session/feed (any member; role gating arrives in M3) ──
  app.get<{ Params: { code: string } }>('/rooms/:code/session', async (req, reply) => {
    if (!authenticate(req, reply)) return
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    if ((req as AuthedRequest).participant!.roomId !== room.id) return reply.code(403).send({ error: 'Not a member of this room' })
    const rs = repository.getRoomSession(room.id)
    return reply.send({ session: rs?.session ?? null, feed: rs?.feed ?? [] })
  })

  app.put<{ Params: { code: string }; Body: { session: unknown; feed: unknown } }>('/rooms/:code/session', async (req, reply) => {
    if (!authenticate(req, reply)) return
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    const me = (req as AuthedRequest).participant!
    if (me.roomId !== room.id) return reply.code(403).send({ error: 'Not a member of this room' })
    // Only the facilitator is authoritative over the live session — players
    // receive it via broadcast and submit actions through /action.
    if (me.role !== 'facilitator') return reply.code(403).send({ error: 'Only the facilitator can update the session' })
    const session = req.body?.session ?? null
    const feed = req.body?.feed ?? []
    repository.upsertRoomSession(room.id, session, feed)
    if (room.status === 'lobby') repository.setRoomStatus(room.id, 'active')
    broadcast(room.id, { type: 'session', session, feed })
    return reply.send({ ok: true })
  })

  // ── End the room session: write earned XP back to each player's own
  //    persisted character (facilitator-only; the facilitator's own DICE
  //    account has no write access to other players' characters, so this
  //    runs server-side on their behalf using each participant's stored
  //    ownerUserId). A level-up is queued (pendingLevelUp) rather than
  //    auto-applied — the player picks their upgrade later from /roster. ──
  app.post<{ Params: { code: string }; Body: { awards?: { characterId: string; xpAwarded: number }[] } }>(
    '/rooms/:code/end',
    async (req, reply) => {
      if (!authenticate(req, reply)) return
      const me = (req as AuthedRequest).participant!
      const room = repository.getRoomByCode(req.params.code.toUpperCase())
      if (!room || me.roomId !== room.id) return reply.code(403).send({ error: 'Not a member of this room' })
      if (me.role !== 'facilitator') return reply.code(403).send({ error: 'Only the facilitator can end the session' })

      const awards = req.body?.awards ?? []
      const roomParticipants = repository.listParticipants(room.id)
      for (const award of awards) {
        // Seats on a role baseline earn no persisted XP (decision D5). Their
        // character ids are namespaced `tmpl:` and match no roster row, so the
        // owner lookup below would miss anyway — this is an explicit guard so
        // the rule is stated where it is enforced rather than being incidental.
        if (award.characterId.startsWith('tmpl:')) continue
        const owner = roomParticipants.find((p) => p.characterId === award.characterId)?.ownerUserId
        if (!owner) continue   // no persisted owner for this character — nothing to write back
        const character = repository.listCharacters(owner).find((c) => c.id === award.characterId)
        if (!character) continue
        const newXp    = character.xp + award.xpAwarded
        const newLevel = levelForXp(newXp)
        repository.upsertCharacter({
          ...character,
          xp: newXp,
          pendingLevelUp: newLevel > character.level ? { newLevel } : character.pendingLevelUp,
        }, owner)
      }
      return reply.send({ ok: true })
    },
  )

  // ── Player submits an action — allowed only on their turn ──
  // The server validates the turn against the live session, then relays the
  // declared action to the room (the facilitator's engine processes it). This
  // is the server-enforced turn gate; the facilitator never trusts the client.
  app.post<{ Params: { code: string }; Body: { text?: string; adoptedFrom?: string } }>('/rooms/:code/action', async (req, reply) => {
    if (!authenticate(req, reply)) return
    const me = (req as AuthedRequest).participant!
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room || me.roomId !== room.id) return reply.code(403).send({ error: 'Not a member of this room' })
    const text = (req.body?.text ?? '').trim()
    if (!text) return reply.code(400).send({ error: 'Action text is required' })
    if (text.length > 1000) return reply.code(400).send({ error: 'Action is too long' })

    const rs = repository.getRoomSession(room.id)
    const session = rs?.session as {
      id?: string
      round?: number
      currentTurnPlayerId?: string
      currentActor?: { participantId: string; characterId: string } | null
    } | null
    if (!session) return reply.code(403).send({ error: 'It is not your turn' })

    // Departmental turns belong to a PARTICIPANT, not a character — someone on
    // the role baseline has no roster character at all, so gating on
    // characterId would lock them out of every turn they are drawn for.
    let actingCharacterId: string
    if (room.mode === 'departmental') {
      if (!session.currentActor || session.currentActor.participantId !== me.id) {
        return reply.code(403).send({ error: 'It is not your turn' })
      }
      actingCharacterId = session.currentActor.characterId
    } else {
      if (!me.characterId) return reply.code(403).send({ error: 'Claim a character before acting' })
      if (session.currentTurnPlayerId !== me.characterId) {
        return reply.code(403).send({ error: 'It is not your turn' })
      }
      actingCharacterId = me.characterId
    }

    // Attribute the turn, and credit whoever's suggestion was taken. Adoption
    // is recorded against the SUGGESTER — "advice the room acted on" is the
    // measure that matters, and it belongs to the person who gave it.
    if (room.mode === 'departmental') {
      const now = Date.now()
      repository.recordParticipantEvent({
        id: randomUUID(), roomId: room.id, sessionId: session.id ?? null, participantId: me.id,
        kind: 'turn_taken', round: session.round ?? null, at: now,
        payload: { text, adoptedFrom: req.body?.adoptedFrom ?? null },
      })
      const adoptedFrom = req.body?.adoptedFrom
      if (adoptedFrom && adoptedFrom !== me.id) {
        const author = repository.getParticipantById(adoptedFrom)
        if (author && author.roomId === room.id) {
          repository.recordParticipantEvent({
            id: randomUUID(), roomId: room.id, sessionId: session.id ?? null, participantId: adoptedFrom,
            kind: 'suggestion_adopted', round: session.round ?? null, at: now,
            payload: { adoptedBy: me.id },
          })
        }
      }
    }

    broadcast(room.id, { type: 'action', participantId: me.id, characterId: actingCharacterId, displayName: me.displayName, text })
    return reply.send({ ok: true })
  })

  // ── Deliberation: a teammate pushes a suggested action to whoever is up ──
  // This is what the other nineteen people do while one person acts (decision
  // D10). Authorised against the live session, so the facilitator turning
  // deliberation off mid-session takes effect immediately and cannot be
  // bypassed by a client that kept its input box on screen.
  app.post<{ Params: { code: string }; Body: { text?: string } }>('/rooms/:code/suggest', async (req, reply) => {
    if (!authenticate(req as AuthedRequest, reply)) return
    const me = (req as AuthedRequest).participant!
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room || me.roomId !== room.id) return reply.code(403).send({ error: 'Not a member of this room' })
    if (room.mode !== 'departmental') return reply.code(409).send({ error: 'Deliberation is a departmental-session feature' })
    // The facilitator runs the DM. Them feeding players their actions would
    // blur the line between the exercise and the person grading it — and under
    // 'anyone' scope nothing else would stop it.
    if (me.role === 'facilitator') return reply.code(403).send({ error: 'The facilitator does not advise players' })

    const text = (req.body?.text ?? '').trim()
    if (!text) return reply.code(400).send({ error: 'A suggestion is required' })
    if (text.length > 500) return reply.code(400).send({ error: 'Keep a suggestion under 500 characters' })

    const rs = repository.getRoomSession(room.id)
    const session = rs?.session as {
      id?: string
      round?: number
      deliberation?: { enabled?: boolean; scope?: string }
      currentActor?: { participantId: string; role: string } | null
    } | null
    if (!session?.deliberation?.enabled) return reply.code(409).send({ error: 'Deliberation is off for this session' })

    const actor = session.currentActor
    if (!actor) return reply.code(409).send({ error: 'Nobody is acting right now' })
    if (actor.participantId === me.id) return reply.code(409).send({ error: 'You are the one acting' })

    // Scope check. The point of scoping is to keep a 90-second window readable,
    // so it is enforced here rather than trusted to the client hiding the box.
    const scope = session.deliberation.scope ?? 'role'
    if (scope === 'role' && me.gameRole !== actor.role) {
      return reply.code(403).send({ error: `Only the ${actor.role} bench can advise this turn` })
    }
    if (scope === 'department') {
      const actorRow = repository.getParticipantById(actor.participantId)
      if (!actorRow?.departmentId || actorRow.departmentId !== me.departmentId) {
        return reply.code(403).send({ error: 'Only their department can advise this turn' })
      }
    }

    const now = Date.now()
    const id = randomUUID()
    // Recorded before broadcast: a suggestion the actor ignores leaves no trace
    // in the narrative feed, but it is still a contribution the after-action
    // report has to be able to attribute.
    repository.recordParticipantEvent({
      id, roomId: room.id, sessionId: session.id ?? null, participantId: me.id,
      kind: 'suggestion', round: session.round ?? null, at: now,
      payload: { text, forParticipantId: actor.participantId },
    })
    broadcast(room.id, {
      type: 'suggestion',
      suggestion: {
        id, participantId: me.id, displayName: me.displayName,
        gameRole: me.gameRole ?? null, text,
        forParticipantId: actor.participantId, createdAt: now,
      },
    })
    return reply.code(201).send({ ok: true, id })
  })

  // ── Per-participant tallies from the event ledger (facilitator only) ──
  // Returns counts, not conclusions: the client joins these with the session's
  // seat map and the narrative feed to build the report, because neither side
  // has all three. Named individual data, per decision D12.
  app.get<{ Params: { code: string }; Querystring: { sessionId?: string } }>(
    '/rooms/:code/tallies', async (req, reply) => {
      const room = requireFacilitatorOf(req as AuthedRequest, reply, req.params.code)
      if (!room) return

      const events = repository.listParticipantEvents(room.id, req.query.sessionId)
      const departments = new Map(repository.listDepartments(room.id).map((d) => [d.id, d.name]))
      const tallies = repository.listParticipants(room.id)
        .filter((p) => p.role !== 'facilitator')
        .map((p) => {
          const mine = events.filter((e) => e.participantId === p.id)
          const count = (kind: string) => mine.filter((e) => e.kind === kind).length
          return {
            participantId:      p.id,
            displayName:        p.displayName,
            gameRole:           p.gameRole ?? null,
            departmentName:     p.departmentId ? departments.get(p.departmentId) ?? null : null,
            turnsTaken:         count('turn_taken'),
            turnsForfeited:     count('turn_forfeit'),
            suggestionsOffered: count('suggestion'),
            suggestionsAdopted: count('suggestion_adopted'),
            disconnects:        count('disconnect'),
          }
        })
      return reply.send({ tallies })
    },
  )

  // ── Facilitator reports a forfeited turn ──
  // A forfeit is a clock event in the facilitator's browser; the server cannot
  // observe it, and it leaves no trace in the narrative feed. Without this the
  // ledger would show a participant who was drawn four times and acted twice
  // as simply having acted twice — losing the fact that they went silent.
  // Deliberately narrow: only the facilitator, only this one event kind.
  app.post<{ Params: { code: string }; Body: { participantId?: string; round?: number } }>(
    '/rooms/:code/forfeit', async (req, reply) => {
      if (!authenticate(req as AuthedRequest, reply)) return
      const me = (req as AuthedRequest).participant!
      const room = repository.getRoomByCode(req.params.code.toUpperCase())
      if (!room || me.roomId !== room.id) return reply.code(403).send({ error: 'Not a member of this room' })
      if (me.role !== 'facilitator') return reply.code(403).send({ error: 'Only the facilitator records a forfeit' })

      const participantId = req.body?.participantId
      if (!participantId) return reply.code(400).send({ error: 'participantId is required' })
      const target = repository.getParticipantById(participantId)
      if (!target || target.roomId !== room.id) return reply.code(404).send({ error: 'Participant not found' })

      const rs = repository.getRoomSession(room.id)
      const session = rs?.session as { id?: string } | null
      repository.recordParticipantEvent({
        id: randomUUID(), roomId: room.id, sessionId: session?.id ?? null,
        participantId, kind: 'turn_forfeit',
        round: typeof req.body?.round === 'number' ? req.body.round : null,
        at: Date.now(), payload: null,
      })
      return reply.code(201).send({ ok: true })
    },
  )

  // ── Facilitator registers the AI provider key (held in memory) ──
  app.put<{ Params: { code: string }; Body: ProviderConfig }>('/rooms/:code/dm-provider', async (req, reply) => {
    if (!authenticate(req, reply)) return
    const me = (req as AuthedRequest).participant!
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room || me.roomId !== room.id) return reply.code(403).send({ error: 'Not a member of this room' })
    if (me.role !== 'facilitator') return reply.code(403).send({ error: 'Only the facilitator can configure the AI provider' })
    if (!req.body?.apiKey || !req.body?.provider) return reply.code(400).send({ error: 'A provider and API key are required' })
    setRoomProvider(room.id, req.body)
    return reply.send({ ok: true })
  })

  // ── Run the DM server-side (facilitator only) ──
  // The LLM call happens here using the server-held key, so the key is not used
  // by the browser during room play. Returns the adjudicated DM response.
  app.post<{ Params: { code: string }; Body: { session: GameSession; action: string; phase: 'init' | 'turn'; orgState?: OrgState; orgProfile?: OrgProfile | null } }>(
    '/rooms/:code/dm',
    async (req, reply) => {
      if (!authenticate(req, reply)) return
      const me = (req as AuthedRequest).participant!
      const room = repository.getRoomByCode(req.params.code.toUpperCase())
      if (!room || me.roomId !== room.id) return reply.code(403).send({ error: 'Not a member of this room' })
      if (me.role !== 'facilitator') return reply.code(403).send({ error: 'Only the facilitator runs the DM' })
      const config = getRoomProvider(room.id)
      if (!config) return reply.code(409).send({ error: 'No AI provider configured for this room' })
      if (!req.body?.session) return reply.code(400).send({ error: 'Session is required' })
      try {
        // Stream the narration to the whole room as it generates, so every
        // member gets the typewriter effect — the key stays server-side. We
        // extract the narration field from the streaming JSON and broadcast it,
        // throttled by growth to avoid a flood of tiny messages.
        let buffer = ''
        let lastLen = 0
        const onChunk = (chunk: string) => {
          buffer += chunk
          const match = buffer.match(/"narration"\s*:\s*"((?:[^"\\]|\\.)*)/)
          if (!match) return
          const narration = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
          if (narration.length - lastLen >= 8) {
            lastLen = narration.length
            broadcast(room.id, { type: 'dm_stream', narration })
          }
        }
        const response = await callDM(config, req.body.session, req.body.action ?? '', onChunk, req.body.orgState, req.body.orgProfile ?? null)
        return reply.send(response)
      } catch (e) {
        req.log.error(e)
        return reply.code(502).send({ error: `DM provider error: ${e instanceof Error ? e.message : String(e)}` })
      }
    },
  )

  // ── Real-time channel: subscribe to a room's live state ──
  // Browsers cannot set headers on a WebSocket, so the bearer token is passed
  // as a query parameter (?token=...). Acceptable on a trusted LAN; M5 hardening
  // can revisit. On connect we authenticate, send a state snapshot, and register
  // the socket to receive broadcasts until it closes.
  app.get<{ Params: { code: string }; Querystring: { token?: string; spectate?: string } }>(
    '/rooms/:code/ws',
    { websocket: true },
    (socket, req) => {
      // CSWSH protection: a browser sends Origin on the WS handshake; reject if it
      // isn't the same host as the server (a cross-site page can't then hijack the
      // socket). Missing Origin (non-browser clients) is allowed.
      const origin = req.headers.origin
      if (origin) {
        let originHost = ''
        try { originHost = new URL(origin).host } catch { /* malformed */ }
        const sameHost = originHost === req.headers.host

        // Development runs the SPA on Vite (port 5173) with /api proxied here.
        // Vite's `changeOrigin: true` rewrites the Host header to the API server
        // but deliberately leaves Origin as the page's own — so a perfectly
        // legitimate browser arrives with Origin localhost:5173 and Host
        // 127.0.0.1:3001. Strict equality rejects it, which silently breaks
        // every room in dev: the client is told 'error', drops its membership,
        // and bounces out of the lobby with nothing in the console.
        //
        // Both sides being loopback is exactly that case, and it is not a
        // cross-site hole: a remote attacker's page cannot be served from a
        // loopback origin without already executing code on this machine. A LAN
        // host (DICE_LAN=1) is unaffected — its players' Origin and Host are the
        // same LAN address, and an attacker's is neither loopback nor a match.
        const bothLoopback = isLoopbackHost(originHost) && isLoopbackHost(req.headers.host)

        if (!sameHost && !bothLoopback) {
          socket.send(JSON.stringify({ type: 'error', error: 'Origin not allowed' }))
          socket.close()
          return
        }
      }

      const room = repository.getRoomByCode(req.params.code.toUpperCase())
      if (!room) {
        socket.send(JSON.stringify({ type: 'error', error: 'unauthorized' }))
        socket.close()
        return
      }

      // Read-only audience connection — no participant row, no token. Requires
      // the explicit ?spectate=1 flag rather than treating "no token" as
      // spectate-by-default, so a mistyped/expired token still hard-fails
      // instead of silently downgrading a would-be player into a spectator.
      // This socket is never listened on for incoming messages (see below —
      // neither branch attaches an `on('message', ...)` handler), so there is
      // no code path by which a spectator could mutate room/session state.
      if (!req.query.token && req.query.spectate === '1') {
        subscribe(room.id, socket, null)
        const rs = repository.getRoomSession(room.id)
        socket.send(JSON.stringify({ type: 'session', session: rs?.session ?? null, feed: rs?.feed ?? [] }))
        socket.on('close', () => unsubscribe(room.id, socket))
        return
      }

      const token = req.query.token
      const participant = token ? repository.getParticipantByTokenHash(hashToken(token)) : null
      if (!participant || participant.roomId !== room.id) {
        socket.send(JSON.stringify({ type: 'error', error: 'unauthorized' }))
        socket.close()
        return
      }
      repository.touchParticipant(participant.id)
      subscribe(room.id, socket, participant.id)
      broadcastLobby(room.id)

      // Initial snapshot so a freshly-connected client is immediately in sync.
      const rs = repository.getRoomSession(room.id)
      socket.send(JSON.stringify({ type: 'session', session: rs?.session ?? null, feed: rs?.feed ?? [] }))
      socket.send(JSON.stringify({
        type: 'lobby',
        participants: repository.listParticipants(room.id).map((p) => toPublicParticipant(p, connectedParticipantIds(room.id))),
        departments: repository.listDepartments(room.id).map(toPublicDepartment),
        mode: room.mode,
      }))

      socket.on('close', () => {
        unsubscribe(room.id, socket)
        // Record the drop only once the participant has NO sockets left — a
        // person with two tabs open closing one has not gone anywhere, and
        // counting that against them in the report would be simply wrong.
        // Only during live play: lobby churn is not a participation signal.
        if (room.mode === 'departmental' && !connectedParticipantIds(room.id).has(participant.id)) {
          const rs = repository.getRoomSession(room.id)
          const live = rs?.session as { id?: string; round?: number; status?: string } | null
          if (live?.status === 'active') {
            repository.recordParticipantEvent({
              id: randomUUID(), roomId: room.id, sessionId: live.id ?? null,
              participantId: participant.id, kind: 'disconnect',
              round: live.round ?? null, at: Date.now(), payload: null,
            })
          }
        }
        broadcastLobby(room.id)
      })
    },
  )
}
