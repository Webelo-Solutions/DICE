// In-memory per-room WebSocket registry + broadcast. Each room has a set of
// connected sockets; state changes are pushed to every member. This is process-
// local, which is correct for the single-process LAN/self-host deployment.

interface Socket {
  send(data: string): void
  readyState: number   // 1 === OPEN
}

const channels = new Map<string, Set<Socket>>()
// Which participant owns each socket — null for a spectator (no participant
// row). Keyed by socket for O(1) cleanup in unsubscribe.
const socketParticipant = new Map<Socket, string | null>()

export function subscribe(roomId: string, socket: Socket, participantId: string | null): void {
  let set = channels.get(roomId)
  if (!set) { set = new Set(); channels.set(roomId, set) }
  set.add(socket)
  socketParticipant.set(socket, participantId)
}

export function unsubscribe(roomId: string, socket: Socket): void {
  const set = channels.get(roomId)
  if (set) { set.delete(socket); if (set.size === 0) channels.delete(roomId) }
  socketParticipant.delete(socket)
}

export function memberCount(roomId: string): number {
  return channels.get(roomId)?.size ?? 0
}

// Participant ids with at least one open socket in this room — dedupes a
// participant connected from multiple tabs/devices, and never includes
// spectators (their participantId is null).
export function connectedParticipantIds(roomId: string): Set<string> {
  const ids = new Set<string>()
  for (const s of channels.get(roomId) ?? []) {
    const pid = socketParticipant.get(s)
    if (pid) ids.add(pid)
  }
  return ids
}

// Broadcast a JSON payload to every open socket in the room.
export function broadcast(roomId: string, payload: unknown): void {
  const set = channels.get(roomId)
  if (!set) return
  const msg = JSON.stringify(payload)
  for (const s of set) {
    if (s.readyState === 1) {
      try { s.send(msg) } catch { /* drop on send failure; close handler will clean up */ }
    }
  }
}
