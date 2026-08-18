import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { repository } from './db/sqlite-repository'
import type { RoomRow, ParticipantRow } from './db/repository'
import { newToken, hashToken, newRoomCode, hashPassphrase, verifyPassphrase } from './auth/tokens'
import { subscribe, unsubscribe, broadcast, connectedParticipantIds } from './realtime'
import { setRoomProvider, getRoomProvider } from './ai-config'
import { callDM } from '../src/engine/dmClient'
import { levelForXp } from '../src/utils/leveling'
import type { Room, Participant, RoomRole } from '../src/types/room'
import type { Character, GameSession } from '../src/types/game'
import type { ProviderConfig } from '../src/types/provider'
import type { OrgState } from '../src/types/orgState'
import type { OrgProfile } from '../src/types/orgProfile'

// Push the current lobby (participant list) to everyone connected to the room.
function broadcastLobby(roomId: string) {
  const connectedIds = connectedParticipantIds(roomId)
  broadcast(roomId, {
    type: 'lobby',
    participants: repository.listParticipants(roomId).map((p) => toPublicParticipant(p, connectedIds)),
  })
}

// Attach the resolved participant to the request (typed locally to avoid global
// Fastify augmentation).
type AuthedRequest = FastifyRequest & { participant?: ParticipantRow }

function toPublicRoom(r: RoomRow): Room {
  return { id: r.id, code: r.code, name: r.name, status: r.status as Room['status'], createdAt: r.createdAt, updatedAt: r.updatedAt }
}
function toPublicParticipant(p: ParticipantRow, connectedIds: Set<string> = new Set()): Participant {
  return {
    id: p.id, roomId: p.roomId, role: p.role as RoomRole, displayName: p.displayName,
    characterId: p.characterId ?? null, character: (p.character as Character | null) ?? null,
    lastSeenAt: p.lastSeenAt, createdAt: p.createdAt,
    connected: connectedIds.has(p.id),
  }
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
  app.post<{ Body: { name?: string; passphrase?: string } }>('/rooms', auth, async (req, reply) => {
    const name = ((req.body?.name ?? '').trim() || 'DICE Session').slice(0, 80)
    const passphrase = req.body?.passphrase ?? ''
    if (passphrase.length < 4) return reply.code(400).send({ error: 'A facilitator passphrase of at least 4 characters is required' })
    if (passphrase.length > 200) return reply.code(400).send({ error: 'Passphrase is too long' })

    // Generate a unique room code (retry on the rare collision).
    let code = newRoomCode()
    for (let i = 0; i < 5 && repository.getRoomByCode(code); i++) code = newRoomCode()

    const now = Date.now()
    const roomId = randomUUID()
    repository.createRoom({ id: roomId, code, name, facilitatorSecretHash: hashPassphrase(passphrase), status: 'lobby', createdAt: now, updatedAt: now })

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
  app.post<{ Params: { code: string }; Body: { characterId?: string } }>('/rooms/:code/join', auth, async (req, reply) => {
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    if (room.status === 'ended') return reply.code(409).send({ error: 'This room has ended' })
    const characterId = req.body?.characterId
    if (!characterId) return reply.code(400).send({ error: 'A character is required to join' })
    const character = repository.listCharacters(req.user!.id).find((c) => c.id === characterId)
    if (!character) return reply.code(404).send({ error: 'Character not found in your roster' })

    const now = Date.now()
    const token = newToken()
    const participantId = randomUUID()
    repository.addParticipant({
      id: participantId, roomId: room.id, role: 'player', displayName: character.name,
      characterId: character.id, character, ownerUserId: req.user!.id,
      tokenHash: hashToken(token), lastSeenAt: now, createdAt: now,
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

  // ── Lobby info by code ──────────────────────────────────────────────────────
  // Stays reachable without an account: the spectator view (/watch/:code) is
  // deliberately login-free and needs the room's name.
  //
  // But a room code is the ONLY thing protecting this, and DICE can now be
  // hosted on the internet — so an anonymous caller gets the room and nothing
  // else. The participant list is real people's names, and handing that to
  // whoever guesses a six-character code is a disclosure that has no upside.
  // A signed-in DICE user still sees it; that is the bar for learning who is
  // in a room.
  //
  // Rate limited far below the global allowance because this is THE endpoint an
  // attacker would use to enumerate codes. Legitimate clients call it once per
  // code they were given; nothing normal comes close to the ceiling.
  app.get<{ Params: { code: string } }>('/rooms/:code', {
    preHandler: app.attachUser,
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room) return reply.code(404).send({ error: 'Room not found' })

    if (!req.user) return reply.send({ room: toPublicRoom(room) })

    const connectedIds = connectedParticipantIds(room.id)
    return reply.send({
      room: toPublicRoom(room),
      participants: repository.listParticipants(room.id).map((p) => toPublicParticipant(p, connectedIds)),
    })
  })

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
  app.post<{ Params: { code: string }; Body: { text?: string } }>('/rooms/:code/action', async (req, reply) => {
    if (!authenticate(req, reply)) return
    const me = (req as AuthedRequest).participant!
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room || me.roomId !== room.id) return reply.code(403).send({ error: 'Not a member of this room' })
    const text = (req.body?.text ?? '').trim()
    if (!text) return reply.code(400).send({ error: 'Action text is required' })
    if (text.length > 1000) return reply.code(400).send({ error: 'Action is too long' })
    if (!me.characterId) return reply.code(403).send({ error: 'Claim a character before acting' })

    const rs = repository.getRoomSession(room.id)
    const session = rs?.session as { currentTurnPlayerId?: string } | null
    if (!session || session.currentTurnPlayerId !== me.characterId) {
      return reply.code(403).send({ error: 'It is not your turn' })
    }
    broadcast(room.id, { type: 'action', participantId: me.id, characterId: me.characterId, displayName: me.displayName, text })
    return reply.send({ ok: true })
  })

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
        if (originHost !== req.headers.host) {
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
      socket.send(JSON.stringify({ type: 'lobby', participants: repository.listParticipants(room.id).map((p) => toPublicParticipant(p, connectedParticipantIds(room.id))) }))

      socket.on('close', () => { unsubscribe(room.id, socket); broadcastLobby(room.id) })
    },
  )
}
