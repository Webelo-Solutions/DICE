import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../store/userStore'
import { useRoomStore } from '../store/roomStore'
import { useGameStore } from '../store/gameStore'
import { roomApi } from '../api/rooms'
import { connectRoom } from '../api/roomSocket'

// Lets a player take over as facilitator when the current one has visibly
// dropped (see the `connected` presence flag on each participant). Fully
// self-contained — reads its own membership/participants, renders nothing
// when not applicable (not a player, or a facilitator is already online).
export function ClaimFacilitatorPanel() {
  const navigate = useNavigate()
  const membership   = useRoomStore((s) => s.membership)
  const participants = useRoomStore((s) => s.participants)

  const [open, setOpen]             = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState<string | null>(null)

  if (!membership || membership.role !== 'player') return null
  // Every claim creates a new participant row without deactivating prior
  // ones, so "is the facilitator here" means at least one facilitator row
  // currently has an open socket — not just that one exists in history.
  const facilitatorConnected = participants.some((p) => p.role === 'facilitator' && p.connected)
  if (facilitatorConnected) return null

  const handleClaim = async () => {
    const userToken = useUserStore.getState().token
    if (!userToken || !passphrase.trim() || busy) return
    setBusy(true); setError(null)
    try {
      const m = await roomApi.claimFacilitator(membership.code, passphrase.trim(), userToken, displayName.trim() || undefined)
      useRoomStore.getState().setMembership({
        code: m.room.code, token: m.token, role: m.participant.role,
        participantId: m.participant.id, displayName: m.participant.displayName, roomName: m.room.name,
      })
      connectRoom(m.room.code, m.token)

      // The fresh session snapshot arrives asynchronously over the new socket
      // — wait for it before deciding whether to jump into a game already in
      // progress. RoomAutoNav explicitly leaves facilitators to navigate
      // themselves, so this is the only thing that will move this browser.
      const unsub = useGameStore.subscribe((state) => {
        if (state.session) {
          unsub()
          if (state.session.status === 'active') navigate('/game')
        }
      })
      setTimeout(unsub, 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full py-2.5 rounded border border-terminal-amber/40 bg-terminal-amber/5
          text-terminal-amber text-xs font-semibold tracking-widest uppercase
          hover:bg-terminal-amber/15 hover:border-terminal-amber/60 transition-all"
      >
        ⚡ Facilitator offline — reclaim control
      </button>
    )
  }

  return (
    <div className="rounded border border-terminal-amber/40 bg-terminal-amber/5 p-4 space-y-2">
      <div className="text-[10px] text-terminal-amber tracking-widest uppercase">Reclaim Facilitator Control</div>
      <input
        type="password"
        autoFocus
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleClaim()}
        placeholder="Facilitator passphrase"
        className="w-full bg-terminal-surface border border-terminal-border rounded px-2 py-1.5
          text-xs text-white font-mono placeholder-terminal-dim/50
          focus:outline-none focus:border-terminal-amber/60"
      />
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleClaim()}
        placeholder="Display name (optional)"
        className="w-full bg-terminal-surface border border-terminal-border rounded px-2 py-1.5
          text-xs text-white font-mono placeholder-terminal-dim/50
          focus:outline-none focus:border-terminal-amber/60"
      />
      {error && <div className="text-[11px] text-terminal-red">{error}</div>}
      <div className="flex gap-2">
        <button
          onClick={handleClaim}
          disabled={busy || !passphrase.trim()}
          className="flex-1 py-1.5 rounded border border-terminal-amber/40 bg-terminal-amber/10
            text-terminal-amber text-xs font-semibold tracking-widest uppercase
            hover:bg-terminal-amber/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          {busy ? 'Claiming…' : 'Claim'}
        </button>
        <button
          onClick={() => { setOpen(false); setError(null) }}
          className="px-3 py-1.5 rounded border border-terminal-border text-terminal-dim
            text-xs hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
