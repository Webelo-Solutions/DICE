import { useGameStore } from '../store/gameStore'
import { useRoomStore } from '../store/roomStore'
import type { GameSession, FeedEntry } from '../types/game'
import type { Participant } from '../types/room'

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
  // action relay
  text?:        string
  characterId?: string
  displayName?: string
  // dm_stream
  narration?:   string
  error?:   string
}

export function connectRoom(code: string, token: string): void {
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
      // Players always render the synced state. The facilitator only takes the
      // initial snapshot (restore on reconnect), then drives locally.
      if (role === 'player') {
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
