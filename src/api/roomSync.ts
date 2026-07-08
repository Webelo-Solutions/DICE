import { useGameStore } from '../store/gameStore'
import { useRoomStore } from '../store/roomStore'

// Facilitator → room write-through. In a room, the facilitator's client is the
// source of truth for the live session/feed: whenever they change, push them to
// the room, which the server broadcasts to every member. Players never push
// (they receive via the WebSocket). Debounced so a burst of per-turn changes
// collapses into one PUT.

let timer: ReturnType<typeof setTimeout> | undefined

function pushSession(code: string, token: string, session: unknown, feed: unknown) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    fetch(`/api/rooms/${encodeURIComponent(code)}/session`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ session, feed }),
    }).catch((e) => console.error('[room-sync]', e))
  }, 300)
}

// Always-on subscription; acts only when the local client is a room facilitator.
export function startRoomSync(): void {
  useGameStore.subscribe((state, prev) => {
    const m = useRoomStore.getState().membership
    if (!m || m.role !== 'facilitator') return
    if (state.session === prev.session && state.feed === prev.feed) return
    pushSession(m.code, m.token, state.session, state.feed)
  })
}
