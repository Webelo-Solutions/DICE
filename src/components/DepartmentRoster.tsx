import { useState } from 'react'
import { roomApi } from '../api/rooms'
import { useRoomStore } from '../store/roomStore'
import { useToastStore } from '../store/toastStore'
import { GAME_ROLES, countStaffing, MAX_DEPARTMENTAL_PARTICIPANTS } from '../types/room'
import type { Participant, Department } from '../types/room'
import type { CharacterClass } from '../types/game'

const selectCls = `bg-terminal-bg border border-terminal-border/60 rounded px-1.5 py-0.5
  text-[10px] text-terminal-dim focus:outline-none focus:border-terminal-green transition-colors`

// The departmental lobby: who is staffing which of the six roles, and how the
// room is organised. Roles are the mechanical unit — an unstaffed role is
// skipped entirely in play, so the staffing panel leads. Departments below it
// are organisational only, and exist to scope leads and group the roster.
export function DepartmentRoster() {
  const membership   = useRoomStore((s) => s.membership)
  const participants = useRoomStore((s) => s.participants)
  const departments  = useRoomStore((s) => s.departments)
  const pushToast    = useToastStore((s) => s.push)
  const [newDept, setNewDept] = useState('')
  const [busy, setBusy] = useState(false)

  if (!membership) return null
  const isFacilitator = membership.role === 'facilitator'
  const members  = participants.filter((p) => p.role !== 'facilitator')
  const staffing = countStaffing(participants)
  const unstaffed = GAME_ROLES.filter((r) => staffing[r] === 0)

  // Every mutation here re-broadcasts the lobby to the whole room, so the local
  // store updates through the socket rather than from the response body.
  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true)
    try { await fn() } catch (e) { pushToast(e instanceof Error ? e.message : `${label} failed`, 'error') }
    finally { setBusy(false) }
  }

  const addDepartment = () => {
    const name = newDept.trim()
    if (!name) return
    run('Adding the department', async () => {
      await roomApi.addDepartment(membership.code, membership.token, name)
      setNewDept('')
    })
  }

  const grouped: Array<{ dept: Department | null; people: Participant[] }> = [
    ...departments.map((dept) => ({ dept, people: members.filter((p) => p.departmentId === dept.id) })),
    { dept: null, people: members.filter((p) => !p.departmentId) },
  ].filter((g) => g.dept !== null || g.people.length > 0)

  return (
    <div className="space-y-4">

      {/* ── Role staffing — the thing that actually decides play ── */}
      <div className="rounded border border-terminal-border bg-terminal-surface/60 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-terminal-border flex items-center justify-between">
          <span className="text-xs font-bold text-terminal-green tracking-widest uppercase">Role Staffing</span>
          <span className={`text-[10px] ${members.length >= MAX_DEPARTMENTAL_PARTICIPANTS ? 'text-terminal-amber' : 'text-terminal-dim'}`}>
            {members.length} / {MAX_DEPARTMENTAL_PARTICIPANTS}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-terminal-border">
          {GAME_ROLES.map((role) => (
            <div key={role} className="px-3 py-2">
              <div className="text-[10px] text-terminal-dim tracking-wide truncate">{role}</div>
              <div className={`text-lg font-bold tabular-nums ${staffing[role] === 0 ? 'text-terminal-amber' : 'text-white'}`}>
                {staffing[role]}
              </div>
            </div>
          ))}
        </div>
        {unstaffed.length > 0 && (
          <div className="px-4 py-2.5 border-t border-terminal-border bg-terminal-amber/5 text-[10px] text-terminal-amber leading-relaxed">
            {unstaffed.length === GAME_ROLES.length
              ? 'No roles are staffed yet.'
              : `${unstaffed.join(', ')} ${unstaffed.length === 1 ? 'is' : 'are'} unstaffed — ${unstaffed.length === 1 ? 'that turn is' : 'those turns are'} skipped entirely, and the capability is absent from the incident.`}
          </div>
        )}
      </div>

      {/* ── Departments — organisational grouping only ── */}
      <div className="rounded border border-terminal-border bg-terminal-surface/60 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-terminal-border flex items-center justify-between">
          <span className="text-xs font-bold text-terminal-green tracking-widest uppercase">Departments</span>
          <span className="text-[10px] text-terminal-dim">{departments.length}</span>
        </div>

        <div className="divide-y divide-terminal-border">
          {grouped.map(({ dept, people }) => (
            <div key={dept?.id ?? 'unassigned'} className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${dept ? 'text-white' : 'text-terminal-dim italic'}`}>
                  {dept?.name ?? 'No department'}
                </span>
                <span className="text-[10px] text-terminal-dim">{people.length}</span>
                {isFacilitator && dept && (
                  <button onClick={() => run('Removing the department', () => roomApi.deleteDepartment(membership.code, membership.token, dept.id))}
                    disabled={busy}
                    className="ml-auto text-[10px] text-terminal-red/70 hover:text-terminal-red transition-colors disabled:opacity-40">
                    Remove
                  </button>
                )}
              </div>

              {people.length === 0 && (
                <div className="text-[10px] text-terminal-dim/50 italic">Nobody has joined this department yet.</div>
              )}

              {people.map((p) => {
                const isLead = dept?.leadParticipantId === p.id
                return (
                  <div key={p.id} className="flex items-center gap-2 flex-wrap">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.connected ? 'bg-terminal-green' : 'bg-terminal-dim/40'}`}
                      title={p.connected ? 'Connected' : 'Offline'} />
                    <span className="text-xs text-white truncate max-w-[9rem]">{p.displayName}</span>
                    {isLead && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber tracking-widest uppercase">
                        Lead
                      </span>
                    )}
                    {p.usesTemplate && (
                      <span className="text-[9px] text-terminal-dim/60" title="Acting on the role's standard sheet — earns no personal XP">
                        standard sheet
                      </span>
                    )}
                    {p.id === membership.participantId && <span className="text-[10px] text-terminal-dim">you</span>}

                    {isFacilitator ? (
                      <div className="ml-auto flex items-center gap-1.5">
                        <select className={selectCls} value={p.gameRole ?? ''} disabled={busy}
                          aria-label={`Role for ${p.displayName}`}
                          onChange={(e) => run('Changing the role', () => roomApi.updateParticipant(
                            membership.code, membership.token, p.id, { gameRole: e.target.value as CharacterClass },
                          ))}>
                          {GAME_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select className={selectCls} value={p.departmentId ?? ''} disabled={busy}
                          aria-label={`Department for ${p.displayName}`}
                          onChange={(e) => run('Moving the participant', () => roomApi.updateParticipant(
                            membership.code, membership.token, p.id, { departmentId: e.target.value || null },
                          ))}>
                          <option value="">No department</option>
                          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        {dept && !isLead && (
                          <button onClick={() => run('Setting the lead', () => roomApi.updateDepartment(
                            membership.code, membership.token, dept.id, { leadParticipantId: p.id },
                          ))} disabled={busy}
                            className="text-[10px] text-terminal-dim hover:text-terminal-amber transition-colors disabled:opacity-40">
                            Make lead
                          </button>
                        )}
                        {dept && isLead && (
                          <button onClick={() => run('Clearing the lead', () => roomApi.updateDepartment(
                            membership.code, membership.token, dept.id, { leadParticipantId: null },
                          ))} disabled={busy}
                            className="text-[10px] text-terminal-dim hover:text-terminal-red transition-colors disabled:opacity-40">
                            Clear lead
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="ml-auto text-[10px] text-terminal-blue">{p.gameRole ?? '—'}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {isFacilitator && (
          <div className="px-4 py-3 border-t border-terminal-border flex gap-2">
            <input value={newDept} onChange={(e) => setNewDept(e.target.value)} maxLength={60}
              onKeyDown={(e) => { if (e.key === 'Enter') addDepartment() }}
              placeholder="Add a department…" aria-label="New department name"
              className="flex-1 bg-terminal-bg border border-terminal-border rounded px-2 py-1.5 text-xs text-white
                placeholder-terminal-dim/50 focus:outline-none focus:border-terminal-green transition-colors" />
            <button onClick={addDepartment} disabled={busy || !newDept.trim()}
              className="px-3 py-1.5 rounded border border-terminal-green/40 text-terminal-green text-[10px]
                font-bold tracking-widest uppercase hover:bg-terminal-green/10 disabled:opacity-30
                disabled:cursor-not-allowed transition-colors">
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
