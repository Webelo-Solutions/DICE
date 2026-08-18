import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { roomApi } from '../api/rooms'
import { useRoomStore } from '../store/roomStore'
import { connectRoom } from '../api/roomSocket'
import { useGameStore } from '../store/gameStore'
import { useUserStore } from '../store/userStore'
import { useToastStore } from '../store/toastStore'
import { EmptyState } from '../components/EmptyState'
import { ROOM_CODE_LENGTH } from '../types/room'

const inputCls = `w-full bg-terminal-surface border border-terminal-border focus:border-terminal-green
  text-white text-sm px-3 py-2.5 rounded focus:outline-none placeholder-terminal-dim transition-colors`

export function JoinGame() {
  const navigate = useNavigate()
  // Pre-fills from the Lobby's QR/join-link (?code=XXXXXX) so scanning it drops
  // a player straight into character selection instead of retyping the room code.
  const [searchParams] = useSearchParams()
  // Room codes are 8 characters; rooms created before that change are 6, and
  // both must still paste and type cleanly — hence a cap rather than a fixed
  // length anywhere in this flow.
  const [code, setCode] = useState(() => (searchParams.get('code') ?? '').toUpperCase().slice(0, ROOM_CODE_LENGTH))
  const [characterId, setCharacterId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const roster    = useGameStore((s) => s.roster)
  const pushToast = useToastStore((s) => s.push)

  const join = async () => {
    if (!characterId) return
    setBusy(true)
    try {
      const userToken = useUserStore.getState().token!
      const m = await roomApi.join(code.trim().toUpperCase(), userToken, characterId)
      useRoomStore.getState().setMembership({
        code: m.room.code, token: m.token, role: m.participant.role,
        participantId: m.participant.id, displayName: m.participant.displayName, roomName: m.room.name,
      })
      connectRoom(m.room.code, m.token)
      navigate('/lobby')
    } catch (e) {
      pushToast(e instanceof Error ? e.message : String(e), 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <div>
          <button onClick={() => navigate('/')} className="text-xs text-terminal-dim hover:text-terminal-green mb-4">← Back</button>
          <h1 className="text-2xl font-bold text-terminal-green tracking-widest uppercase">Join Game</h1>
          <p className="text-xs text-terminal-dim mt-1">Enter the room code your facilitator shared, and bring one of your own characters — XP and skills earned this session carry back to your roster.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1 block">Room Code</label>
            <input className={`${inputCls} tracking-[0.4em] text-center text-lg uppercase`} value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={ROOM_CODE_LENGTH} placeholder="7KQ9MXBT" />
          </div>
          <div>
            <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1.5 block">Choose Your Character</label>
            {roster.length === 0 ? (
              <EmptyState
                message="No characters in your roster yet."
                action={
                  <button onClick={() => navigate('/create')}
                    className="text-xs text-terminal-green underline underline-offset-2">
                    Create one, then come back with the room code
                  </button>
                }
              />
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {roster.map((c) => (
                  <button key={c.id} type="button" onClick={() => setCharacterId(c.id)}
                    className={`w-full text-left px-3 py-2 rounded border transition-all flex items-center justify-between gap-2 ${characterId === c.id
                      ? 'border-terminal-green bg-terminal-green/10'
                      : 'border-terminal-border bg-terminal-surface hover:border-terminal-dim'}`}>
                    <div className="min-w-0">
                      <div className={`text-xs font-semibold truncate ${characterId === c.id ? 'text-terminal-green' : 'text-white'}`}>{c.name}</div>
                      <div className="text-[10px] text-terminal-dim leading-tight mt-0.5">{c.class}</div>
                    </div>
                    <div className="text-[10px] text-terminal-dim flex-shrink-0">LVL {c.level} · {c.xp} XP</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button onClick={join} disabled={busy || code.trim().length < 4 || !characterId}
          className="w-full py-3 rounded border border-terminal-green bg-terminal-green/10 text-terminal-green
            font-bold text-sm tracking-widest uppercase hover:bg-terminal-green/20
            disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          {busy ? 'Joining…' : 'Join Room'}
        </button>
      </div>
    </div>
  )
}
