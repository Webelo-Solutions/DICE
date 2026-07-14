import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { roomApi } from '../api/rooms'
import { useRoomStore } from '../store/roomStore'
import { connectRoom } from '../api/roomSocket'
import { CLASS_DEFAULTS } from '../data/classDefaults'
import type { CharacterClass } from '../types/game'

const inputCls = `w-full bg-terminal-surface border border-terminal-border focus:border-terminal-green
  text-white text-sm px-3 py-2.5 rounded focus:outline-none placeholder-terminal-dim transition-colors`

export function JoinGame() {
  const navigate = useNavigate()
  // Pre-fills from the Lobby's QR/join-link (?code=XXXXXX) so scanning it drops
  // a player straight into name+role entry instead of retyping the room code.
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState(() => (searchParams.get('code') ?? '').toUpperCase().slice(0, 6))
  const [displayName, setDisplayName] = useState('')
  const [charClass, setCharClass] = useState<CharacterClass | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const join = async () => {
    if (!charClass) return
    setBusy(true); setError(null)
    try {
      const m = await roomApi.join(code.trim().toUpperCase(), displayName.trim(), charClass)
      useRoomStore.getState().setMembership({
        code: m.room.code, token: m.token, role: m.participant.role,
        participantId: m.participant.id, displayName: m.participant.displayName, roomName: m.room.name,
      })
      connectRoom(m.room.code, m.token)
      navigate('/lobby')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5">
        <div>
          <button onClick={() => navigate('/')} className="text-xs text-terminal-dim hover:text-terminal-green mb-4">← Back</button>
          <h1 className="text-2xl font-bold text-terminal-green tracking-widest uppercase">Join Game</h1>
          <p className="text-xs text-terminal-dim mt-1">Enter the room code your facilitator shared.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1 block">Room Code</label>
            <input className={`${inputCls} tracking-[0.4em] text-center text-lg uppercase`} value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="7KQ9MX" />
          </div>
          <div>
            <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1 block">Your Name</label>
            <input className={inputCls} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alex" />
          </div>
          <div>
            <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1.5 block">Choose Your Role</label>
            <div className="grid grid-cols-2 gap-2">
              {CLASS_DEFAULTS.map((c) => (
                <button key={c.class} type="button" onClick={() => setCharClass(c.class)}
                  className={`text-left px-3 py-2 rounded border transition-all ${charClass === c.class
                    ? 'border-terminal-green bg-terminal-green/10'
                    : 'border-terminal-border bg-terminal-surface hover:border-terminal-dim'}`}>
                  <div className={`text-xs font-semibold ${charClass === c.class ? 'text-terminal-green' : 'text-white'}`}>{c.class}</div>
                  <div className="text-[10px] text-terminal-dim leading-tight mt-0.5">{c.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="text-xs text-terminal-red border border-terminal-red/30 bg-terminal-red/10 rounded px-3 py-2">{error}</div>}

        <button onClick={join} disabled={busy || code.trim().length < 4 || !displayName.trim() || !charClass}
          className="w-full py-3 rounded border border-terminal-green bg-terminal-green/10 text-terminal-green
            font-bold text-sm tracking-widest uppercase hover:bg-terminal-green/20
            disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          {busy ? 'Joining…' : 'Join Room'}
        </button>
      </div>
    </div>
  )
}
