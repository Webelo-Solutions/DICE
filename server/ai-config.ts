import type { ProviderConfig } from '../src/types/provider'

// Per-room AI provider config, held in memory only (never written to the DB or
// returned to clients). The facilitator sends their key once when the room
// session starts; the server uses it to run the DM. Lost on restart by design —
// the client re-sends it if the server reports it missing.
const roomProviders = new Map<string, ProviderConfig>()

export function setRoomProvider(roomId: string, config: ProviderConfig): void {
  roomProviders.set(roomId, config)
}
export function getRoomProvider(roomId: string): ProviderConfig | undefined {
  return roomProviders.get(roomId)
}
export function clearRoomProvider(roomId: string): void {
  roomProviders.delete(roomId)
}
