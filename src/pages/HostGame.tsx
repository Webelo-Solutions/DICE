import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { roomApi } from '../api/rooms'
import { useRoomStore } from '../store/roomStore'
import { connectRoom } from '../api/roomSocket'
import { useToastStore } from '../store/toastStore'
import { useUserStore } from '../store/userStore'
import { MAX_DEPARTMENTAL_PARTICIPANTS } from '../types/room'
import type { RoomMode } from '../types/room'

const inputCls = `w-full bg-terminal-surface border border-terminal-border focus:border-terminal-green
  text-white text-sm px-3 py-2.5 rounded focus:outline-none placeholder-terminal-dim transition-colors`

// A starting point a facilitator can edit in the lobby — most teams recognise
// these, and an empty list makes the join screen look broken.
const SUGGESTED_DEPARTMENTS = 'Blue Team\nThreat Intel\nPlatform\nCrisis Cell'

export function HostGame() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [mode, setMode] = useState<RoomMode>('standard')
  const [departmentText, setDepartmentText] = useState(SUGGESTED_DEPARTMENTS)
  const [busy, setBusy] = useState(false)
  const pushToast = useToastStore((s) => s.push)

  const departments = departmentText.split('\n').map((d) => d.trim()).filter(Boolean)

  const host = async () => {
    setBusy(true)
    try {
      const userToken = useUserStore.getState().token!
      const m = await roomApi.create(
        name.trim() || 'DICE Session', passphrase, userToken,
        mode, mode === 'departmental' ? departments : [],
      )
      useRoomStore.getState().setMembership({
        code: m.room.code, token: m.token, role: m.participant.role,
        participantId: m.participant.id, displayName: m.participant.displayName,
        roomName: m.room.name, mode: m.room.mode,
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
          <h1 className="text-2xl font-bold text-terminal-green tracking-widest uppercase">Host Game</h1>
          <p className="text-xs text-terminal-dim mt-1">Create a room and become its facilitator. Players join with the room code.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1 block">Room Name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday IR Drill" />
          </div>

          {/* Session size. This is fixed once the room exists — the join screen
              branches on it — so it is presented as a deliberate choice up front
              rather than a setting buried in the lobby. */}
          <div>
            <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1.5 block">Session Size</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'standard'     as const, title: 'Standard',     detail: 'Up to 6 players, one character each' },
                { value: 'departmental' as const, title: 'Departmental', detail: `Up to ${MAX_DEPARTMENTAL_PARTICIPANTS}, rotating through the 6 roles` },
              ]).map((opt) => (
                <button key={opt.value} type="button" onClick={() => setMode(opt.value)}
                  aria-pressed={mode === opt.value}
                  className={`text-left px-3 py-2.5 rounded border transition-all ${mode === opt.value
                    ? 'border-terminal-green bg-terminal-green/10'
                    : 'border-terminal-border bg-terminal-surface hover:border-terminal-dim'}`}>
                  <div className={`text-xs font-bold tracking-wide ${mode === opt.value ? 'text-terminal-green' : 'text-white'}`}>{opt.title}</div>
                  <div className="text-[10px] text-terminal-dim leading-tight mt-0.5">{opt.detail}</div>
                </button>
              ))}
            </div>
            {mode === 'departmental' && (
              <p className="text-[10px] text-terminal-dim/60 mt-1.5 leading-relaxed">
                Each round every staffed role takes one turn, and a rotation picks who acts for it —
                so a round stays the same length whether 8 or 24 people are in the session.
              </p>
            )}
          </div>

          {mode === 'departmental' && (
            <div>
              <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1 block">
                Departments <span className="text-terminal-dim/50 normal-case tracking-normal">— one per line</span>
              </label>
              <textarea className={`${inputCls} h-24 resize-none leading-relaxed`} value={departmentText}
                onChange={(e) => setDepartmentText(e.target.value)} placeholder="Blue Team" />
              <p className="text-[10px] text-terminal-dim/60 mt-1">
                {departments.length === 0
                  ? 'Optional — participants can join without a department, and you can add these later.'
                  : `${departments.length} department${departments.length === 1 ? '' : 's'}. Participants pick from this list, so names stay consistent. Editable in the lobby.`}
              </p>
            </div>
          )}

          <div>
            <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1 block">Facilitator Passphrase</label>
            <input className={inputCls} type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="At least 4 characters" />
            <p className="text-[10px] text-terminal-dim/60 mt-1">Used to reclaim facilitator control from another device. Keep it private.</p>
          </div>
        </div>

        <button onClick={host} disabled={busy || passphrase.length < 4}
          className="w-full py-3 rounded border border-terminal-green bg-terminal-green/10 text-terminal-green
            font-bold text-sm tracking-widest uppercase hover:bg-terminal-green/20
            disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          {busy ? 'Creating…' : 'Create Room'}
        </button>
      </div>
    </div>
  )
}
