import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { roomApi } from '../api/rooms'
import { useRoomStore } from '../store/roomStore'
import { connectRoom } from '../api/roomSocket'
import { useToastStore } from '../store/toastStore'
import { useUserStore } from '../store/userStore'

const inputCls = `w-full bg-terminal-surface border border-terminal-border focus:border-terminal-green
  text-white text-sm px-3 py-2.5 rounded focus:outline-none placeholder-terminal-dim transition-colors`

export function HostGame() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const pushToast = useToastStore((s) => s.push)

  const host = async () => {
    setBusy(true)
    try {
      const userToken = useUserStore.getState().token!
      const m = await roomApi.create(name.trim() || 'DICE Session', passphrase, userToken)
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
          <h1 className="text-2xl font-bold text-terminal-green tracking-widest uppercase">Host Game</h1>
          <p className="text-xs text-terminal-dim mt-1">Create a room and become its facilitator. Players join with the room code.</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1 block">Room Name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday IR Drill" />
          </div>
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
