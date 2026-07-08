import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { repository } from './db/sqlite-repository'
import type { RoomRow, ParticipantRow } from './db/repository'
import { newToken, hashToken, newRoomCode, hashPassphrase, verifyPassphrase } from './auth/tokens'
import { subscribe, unsubscribe, broadcast } from './realtime'
import { makeDefaultCharacter, isCharacterClass } from '../src/data/classDefaults'
import { setRoomProvider, getRoomProvider } from './ai-config'
import { callDM } from '../src/engine/dmClient'
import type { Room, Participant, RoomRole } from '../src/types/room'
import type { Character, GameSession } from '../src/types/game'
import type { ProviderConfig } from '../src/types/provider'
import type { OrgState } from '../src/types/orgState'
import type { OrgProfile } from '../src/types/orgProfile'

// Push the current lobby (participant list) to everyone connected to the room.
function broadcastLobby(roomId: string) {
  broadcast(roomId, { type: 'lobby', participants: repository.listParticipants(roomId).map(toPublicParticipant) })
}

// Attach the resolved participant to the request (typed locally to avoid global
// Fastify augmentation).
type AuthedRequest = FastifyRequest & { participant?: ParticipantRow }

function toPublicRoom(r: RoomRow): Room {
  return { id: r.id, code: r.code, name: r.name, status: r.status as Room['status'], createdAt: r.createdAt, updatedAt: r.updatedAt }
}
function toPublicParticipant(p: ParticipantRow): Participant {
  return {
    id: p.id, roomId: p.roomId, role: p.role as RoomRole, displayName: p.displayName,
    characterId: p.characterId ?? null, character: (p.character as Character | null) ?? null,
    lastSeenAt: p.lastSeenAt, createdAt: p.createdAt,
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
  // ── Create a room (become its facilitator) ──────────────
  app.post<{ Body: { name?: string; passphrase?: string } }>('/rooms', async (req, reply) => {
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
    repository.addParticipant({ id: participantId, roomId, role: 'facilitator', displayName: 'Facilitator', characterId: null, character: null, tokenHash: hashToken(token), lastSeenAt: now, createdAt: now })

    const room = repository.getRoomById(roomId)!
    const participant = repository.getParticipantByTokenHash(hashToken(token))!
    return reply.code(201).send({ room: toPublicRoom(room), participant: toPublicParticipant(participant), token })
  })

  // ── Join a room as a player ─────────────────────────────
  app.post<{ Params: { code: string }; Body: { displayName?: string; class?: string } }>('/rooms/:code/join', async (req, reply) => {
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    if (room.status === 'ended') return reply.code(409).send({ error: 'This room has ended' })
    const displayName = (req.body?.displayName ?? '').trim().slice(0, 40)
    if (!displayName) return reply.code(400).send({ error: 'A display name is required' })
    const charClass = req.body?.class
    if (!isCharacterClass(charClass)) return reply.code(400).send({ error: 'A valid character class is required' })

    // Each player IS their own character (Option B): build it from the chosen class.
    const now = Date.now()
    const token = newToken()
    const participantId = randomUUID()
    const characterId = randomUUID()
    const character = makeDefaultCharacter(characterId, displayName, charClass)
    repository.addParticipant({ id: participantId, roomId: room.id, role: 'player', displayName, characterId, character, tokenHash: hashToken(token), lastSeenAt: now, createdAt: now })

    const participant = repository.getParticipantByTokenHash(hashToken(token))!
    broadcastLobby(room.id)
    return reply.code(201).send({ room: toPublicRoom(room), participant: toPublicParticipant(participant), token })
  })

  // ── Claim/reclaim facilitator control with the passphrase ──
  app.post<{ Params: { code: string }; Body: { passphrase?: string; displayName?: string } }>('/rooms/:code/claim-facilitator', async (req, reply) => {
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    if (!verifyPassphrase(req.body?.passphrase ?? '', room.facilitatorSecretHash)) {
      return reply.code(403).send({ error: 'Incorrect facilitator passphrase' })
    }
    const now = Date.now()
    const token = newToken()
    const participantId = randomUUID()
    repository.addParticipant({ id: participantId, roomId: room.id, role: 'facilitator', displayName: ((req.body?.displayName ?? 'Facilitator').trim() || 'Facilitator').slice(0, 40), characterId: null, character: null, tokenHash: hashToken(token), lastSeenAt: now, createdAt: now })

    const participant = repository.getParticipantByTokenHash(hashToken(token))!
    broadcastLobby(room.id)
    return reply.send({ room: toPublicRoom(room), participant: toPublicParticipant(participant), token })
  })

  // ── Lobby info (public by code on a trusted LAN) ────────
  app.get<{ Params: { code: string } }>('/rooms/:code', async (req, reply) => {
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    return reply.send({ room: toPublicRoom(room), participants: repository.listParticipants(room.id).map(toPublicParticipant) })
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

  // ── Player claims (or releases) a roster character ─────
  app.post<{ Params: { code: string }; Body: { characterId: string | null } }>('/rooms/:code/claim-character', async (req, reply) => {
    if (!authenticate(req, reply)) return
    const me = (req as AuthedRequest).participant!
    const room = repository.getRoomByCode(req.params.code.toUpperCase())
    if (!room || me.roomId !== room.id) return reply.code(403).send({ error: 'Not a member of this room' })
    repository.setParticipantCharacter(me.id, req.body?.characterId ?? null)
    broadcastLobby(room.id)
    return reply.send({ ok: true })
  })

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
  app.get<{ Params: { code: string }; Querystring: { token?: string } }>(
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
      const token = req.query.token
      const participant = token ? repository.getParticipantByTokenHash(hashToken(token)) : null
      if (!room || !participant || participant.roomId !== room.id) {
        socket.send(JSON.stringify({ type: 'error', error: 'unauthorized' }))
        socket.close()
        return
      }
      repository.touchParticipant(participant.id)
      subscribe(room.id, socket)

      // Initial snapshot so a freshly-connected client is immediately in sync.
      const rs = repository.getRoomSession(room.id)
      socket.send(JSON.stringify({ type: 'session', session: rs?.session ?? null, feed: rs?.feed ?? [] }))
      socket.send(JSON.stringify({ type: 'lobby', participants: repository.listParticipants(room.id).map(toPublicParticipant) }))

      socket.on('close', () => unsubscribe(room.id, socket))
    },
  )
}
