import { useGameStore } from '../store/gameStore'
import { useRoomStore } from '../store/roomStore'
import type { GameSession, FeedEntry } from '../types/game'
import type { Participant, Department, RoomMode } from '../types/room'

// Connects to a room's real-time channel and applies server broadcasts to the
// stores. Live session/feed updates flow into the gameStore; lobby updates into
// the roomStore. Auto-reconnects with a short backoff unless we left on purpose.

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let intentionalClose = false
// The facilitator is the source of truth for the session, so it ignores session
// broadcasts (which are its own echoes) EXCEPT the first snapshot on (re)connect,
// which restores state. Players always apply. Reset on each new connection.
let facilitatorAppliedSnapshot = false

interface ServerMessage {
  type:    'session' | 'lobby' | 'action' | 'dm_stream' | 'error'
  session?: GameSession | null
  feed?:    FeedEntry[]
  participants?: Participant[]
  departments?:  Department[]
  mode?:         RoomMode
  // action relay
  text?:        string
  characterId?: string
  displayName?: string
  // dm_stream
  narration?:   string
  error?:   string
}

export function connectRoom(code: string, token: string): void {
  // connectRoom is called more than once per session by design (e.g. Join/HostGame
  // connect immediately, then Lobby's mount effect connects again) — tear down any
  // existing socket first so the old one doesn't keep running with a stale onclose
  // (which would otherwise fire later, sharing the module-level state below with
  // the new connection, and could trigger a spurious extra reconnect).
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (socket) { socket.onclose = null; socket.close() }

  intentionalClose = false
  facilitatorAppliedSnapshot = false
  // Reuse the page's scheme/host so this works behind the Vite dev proxy and in
  // production (same origin). wss when the page is https.
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  const url = `${proto}://${window.location.host}/api/rooms/${encodeURIComponent(code)}/ws?token=${encodeURIComponent(token)}`

  socket = new WebSocket(url)

  socket.onopen = () => useRoomStore.getState().setConnected(true)

  socket.onmessage = (event) => {
    let msg: ServerMessage
    try { msg = JSON.parse(event.data) } catch { return }
    if (msg.type === 'session') {
      const role = useRoomStore.getState().membership?.role
      // Everyone who is NOT the facilitator renders the synced state — that
      // includes department leads, who are players with extra lobby powers and
      // no authority over the session. Testing for 'player' by name would leave
      // a dept_lead frozen on whatever state they held when they were promoted.
      // The facilitator only takes the initial snapshot (restore on reconnect),
      // then drives locally.
      if (role && role !== 'facilitator') {
        useGameStore.setState({ session: msg.session ?? null, feed: msg.feed ?? [] })
      } else if (!facilitatorAppliedSnapshot) {
        useGameStore.setState({ session: msg.session ?? null, feed: msg.feed ?? [] })
        facilitatorAppliedSnapshot = true
      }
      // The final narration is now in the feed — clear the live streaming preview.
      useRoomStore.getState().clearStreamingNarration()
    } else if (msg.type === 'dm_stream') {
      useRoomStore.getState().setStreamingNarration(msg.narration ?? '')
    } else if (msg.type === 'lobby') {
      useRoomStore.getState().setParticipants(msg.participants ?? [])
      useRoomStore.getState().setDepartments(msg.departments ?? [])
      // The server owns the room role: a facilitator promoting someone to
      // department lead has to reach that client's own membership, or they
      // keep rendering the plain player view until they refresh.
      const state = useRoomStore.getState()
      const me = msg.participants?.find((p) => p.id === state.membership?.participantId)
      const mode = msg.mode ?? state.membership?.mode
      if (state.membership && (
        (me && me.role !== state.membership.role) || mode !== state.membership.mode
      )) {
        state.setMembership({ ...state.membership, role: me?.role ?? state.membership.role, mode })
      }
    } else if (msg.type === 'action') {
      // A player's turn action, relayed by the server. Only the facilitator's
      // client processes it (it runs the game engine).
      if (useRoomStore.getState().membership?.role === 'facilitator' && msg.text && msg.characterId) {
        useRoomStore.getState().setIncomingAction({ text: msg.text, characterId: msg.characterId, displayName: msg.displayName ?? '' })
      }
    } else if (msg.type === 'error') {
      // Token rejected by the server — drop membership and stop reconnecting.
      intentionalClose = true
      useRoomStore.getState().clearMembership()
    }
  }

  socket.onclose = () => {
    useRoomStore.getState().setConnected(false)
    if (!intentionalClose && useRoomStore.getState().membership) {
      reconnectTimer = setTimeout(() => connectRoom(code, token), 1500)
    }
  }
}

export function disconnectRoom(): void {
  intentionalClose = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  socket?.close()
  socket = null
}
