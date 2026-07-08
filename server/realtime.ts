// In-memory per-room WebSocket registry + broadcast. Each room has a set of
// connected sockets; state changes are pushed to every member. This is process-
// local, which is correct for the single-process LAN/self-host deployment.

interface Socket {
  send(data: string): void
  readyState: number   // 1 === OPEN
}

const channels = new Map<string, Set<Socket>>()

export function subscribe(roomId: string, socket: Socket): void {
  let set = channels.get(roomId)
  if (!set) { set = new Set(); channels.set(roomId, set) }
  set.add(socket)
}

export function unsubscribe(roomId: string, socket: Socket): void {
  const set = channels.get(roomId)
  if (!set) return
  set.delete(socket)
  if (set.size === 0) channels.delete(roomId)
}

export function memberCount(roomId: string): number {
  return channels.get(roomId)?.size ?? 0
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
