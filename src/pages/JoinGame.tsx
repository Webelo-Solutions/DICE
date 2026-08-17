import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { roomApi } from '../api/rooms'
import { useRoomStore } from '../store/roomStore'
import { connectRoom } from '../api/roomSocket'
import { useGameStore } from '../store/gameStore'
import { useUserStore } from '../store/userStore'
import { useToastStore } from '../store/toastStore'
import { EmptyState } from '../components/EmptyState'
import { GAME_ROLES, countStaffing } from '../types/room'
import type { Department, Participant, RoomMode, RoleStaffing } from '../types/room'
import type { CharacterClass } from '../types/game'

const inputCls = `w-full bg-terminal-surface border border-terminal-border focus:border-terminal-green
  text-white text-sm px-3 py-2.5 rounded focus:outline-none placeholder-terminal-dim transition-colors`

// What the join screen learned by looking the room code up. Fetched as soon as
// a full code is typed, because the whole form below branches on room.mode.
interface RoomPeek {
  mode:         RoomMode
  name:         string
  departments:  Department[]
  participants: Participant[]
  staffing:     RoleStaffing
}

export function JoinGame() {
  const navigate = useNavigate()
  // Pre-fills from the Lobby's QR/join-link (?code=XXXXXX) so scanning it drops
  // a player straight into character selection instead of retyping the room code.
  const [searchParams] = useSearchParams()
  const [code, setCode] = useState(() => (searchParams.get('code') ?? '').toUpperCase().slice(0, 6))
  const [characterId, setCharacterId] = useState<string | null>(null)
  const [gameRole, setGameRole] = useState<CharacterClass | null>(null)
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [peek, setPeek] = useState<RoomPeek | null>(null)
  const [busy, setBusy] = useState(false)
  const roster    = useGameStore((s) => s.roster)
  const pushToast = useToastStore((s) => s.push)
  const user      = useUserStore((s) => s.user)

  // Look the room up as soon as a plausible code exists, so the form can show
  // the right fields before anyone commits. A miss just leaves peek null — the
  // real validation happens server-side on submit.
  useEffect(() => {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 4) { setPeek(null); return }
    let cancelled = false
    roomApi.getLobby(trimmed)
      .then(({ room, participants, departments }) => {
        if (cancelled) return
        setPeek({
          mode: room.mode, name: room.name, departments, participants,
          staffing: countStaffing(participants),
        })
      })
      .catch(() => { if (!cancelled) setPeek(null) })
    return () => { cancelled = true }
  }, [code])

  // Seed the display name from the signed-in account — in a 20-person session
  // the roster is read by a facilitator who needs to recognise real people.
  useEffect(() => {
    if (!displayName && user?.displayName) setDisplayName(user.displayName)
  }, [user?.displayName])

  const isDepartmental = peek?.mode === 'departmental'

  // A character resolves the roll on its own stats and traits, so it has to be
  // the right kind of specialist for the seat. Picking a role narrows the
  // roster to characters of that class; anyone else joins on the role's
  // baseline template instead.
  const eligibleRoster = isDepartmental && gameRole
    ? roster.filter((c) => c.class === gameRole)
    : roster

  const canJoin = isDepartmental
    ? !!gameRole && displayName.trim().length > 0
    : !!characterId

  const join = async () => {
    if (!canJoin) return
    setBusy(true)
    try {
      const userToken = useUserStore.getState().token!
      const m = await roomApi.join(code.trim().toUpperCase(), userToken, isDepartmental
        ? { gameRole: gameRole!, departmentId, displayName: displayName.trim(), characterId: characterId ?? undefined }
        : { characterId: characterId! })
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
      <div className="w-full max-w-sm space-y-5 py-8">
        <div>
          <button onClick={() => navigate('/')} className="text-xs text-terminal-dim hover:text-terminal-green mb-4">← Back</button>
          <h1 className="text-2xl font-bold text-terminal-green tracking-widest uppercase">Join Game</h1>
          <p className="text-xs text-terminal-dim mt-1">
            {isDepartmental
              ? 'Enter the room code, then pick the role you are staffing. Bringing one of your own characters is optional.'
              : 'Enter the room code your facilitator shared, and bring one of your own characters — XP and skills earned this session carry back to your roster.'}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1 block" htmlFor="room-code">Room Code</label>
            <input id="room-code" className={`${inputCls} tracking-[0.4em] text-center text-lg uppercase`} value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} placeholder="7KQ9MX" />
            {peek && (
              <p className="text-[10px] text-terminal-green/80 mt-1 text-center">
                {peek.name}
                {isDepartmental && ` · departmental · ${peek.participants.filter((p) => p.role !== 'facilitator').length} joined`}
              </p>
            )}
          </div>

          {/* ── Departmental join: name, role, department, optional character ── */}
          {isDepartmental && (
            <>
              <div>
                <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1 block" htmlFor="display-name">Your Name</label>
                <input id="display-name" className={inputCls} value={displayName} maxLength={40}
                  onChange={(e) => setDisplayName(e.target.value)} placeholder="Ana Reyes" />
              </div>

              <div>
                <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1.5 block">Role You Are Staffing</label>
                <div className="space-y-1.5">
                  {GAME_ROLES.map((role) => {
                    const staffed = peek.staffing[role]
                    const selected = gameRole === role
                    return (
                      <button key={role} type="button"
                        onClick={() => { setGameRole(role); setCharacterId(null) }}
                        aria-pressed={selected}
                        className={`w-full text-left px-3 py-2 rounded border transition-all flex items-center justify-between gap-2 ${selected
                          ? 'border-terminal-green bg-terminal-green/10'
                          : 'border-terminal-border bg-terminal-surface hover:border-terminal-dim'}`}>
                        <span className={`text-xs font-semibold ${selected ? 'text-terminal-green' : 'text-white'}`}>{role}</span>
                        <span className={`text-[10px] flex-shrink-0 ${staffed === 0 ? 'text-terminal-amber' : 'text-terminal-dim'}`}>
                          {staffed === 0 ? 'unstaffed' : `${staffed} staffing`}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-[10px] text-terminal-dim/60 mt-1.5 leading-relaxed">
                  An unstaffed role is skipped entirely during play — its capability is simply absent from the incident.
                </p>
              </div>

              {peek.departments.length > 0 && (
                <div>
                  <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1 block" htmlFor="department">
                    Department <span className="text-terminal-dim/50 normal-case tracking-normal">— optional</span>
                  </label>
                  <select id="department" className={inputCls} value={departmentId ?? ''}
                    onChange={(e) => setDepartmentId(e.target.value || null)}>
                    <option value="">No department</option>
                    {peek.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}

              {gameRole && (
                <div>
                  <label className="text-[10px] text-terminal-dim tracking-widest uppercase mb-1.5 block">
                    Your Character <span className="text-terminal-dim/50 normal-case tracking-normal">— optional</span>
                  </label>
                  <div className="space-y-1.5">
                    <button type="button" onClick={() => setCharacterId(null)}
                      aria-pressed={characterId === null}
                      className={`w-full text-left px-3 py-2 rounded border transition-all ${characterId === null
                        ? 'border-terminal-green bg-terminal-green/10'
                        : 'border-terminal-border bg-terminal-surface hover:border-terminal-dim'}`}>
                      <div className={`text-xs font-semibold ${characterId === null ? 'text-terminal-green' : 'text-white'}`}>
                        Use the standard {gameRole} sheet
                      </div>
                      <div className="text-[10px] text-terminal-dim leading-tight mt-0.5">
                        Join now — you earn no XP toward a character of your own
                      </div>
                    </button>
                    {eligibleRoster.map((c) => (
                      <button key={c.id} type="button" onClick={() => setCharacterId(c.id)}
                        aria-pressed={characterId === c.id}
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
                  {eligibleRoster.length === 0 && (
                    <p className="text-[10px] text-terminal-dim/60 mt-1.5 leading-relaxed">
                      You have no {gameRole} in your roster. Join on the standard sheet, or{' '}
                      <button onClick={() => navigate('/create')} className="text-terminal-green underline underline-offset-2">
                        create one first
                      </button>{' '}
                      to keep the XP you earn.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Standard join: one player, one character (unchanged) ── */}
          {!isDepartmental && (
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
                      aria-pressed={characterId === c.id}
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
          )}
        </div>

        <button onClick={join} disabled={busy || code.trim().length < 4 || !canJoin}
          className="w-full py-3 rounded border border-terminal-green bg-terminal-green/10 text-terminal-green
            font-bold text-sm tracking-widest uppercase hover:bg-terminal-green/20
            disabled:opacity-30 disabled:cursor-not-allowed transition-all">
          {busy ? 'Joining…' : 'Join Room'}
        </button>
      </div>
    </div>
  )
}
