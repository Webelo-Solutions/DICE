import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiAdmin, type AdminUserRow } from '../api/admin'
import { aggregateGaps, winRate, totalXpEarned, scenarioCoverage } from '../utils/gapAnalysis'
import { formatTimestamp } from '../utils/learningPath'
import type { SessionRecord } from '../types/history'
import type { LearningPriority } from '../types/game'

type Session = SessionRecord & { ownerUserId: string | null }

const PRIORITY_COLOR: Record<LearningPriority, string> = {
  critical: 'border-red-300 bg-red-50 text-red-700',
  high:     'border-orange-300 bg-orange-50 text-orange-700',
  medium:   'border-amber-300 bg-amber-50 text-amber-700',
  low:      'border-blue-300 bg-blue-50 text-blue-700',
}

type CadenceStatus = 'never' | 'overdue' | 'due-soon' | 'on-track'

const CADENCE_STYLE: Record<CadenceStatus, { label: string; cls: string }> = {
  never:     { label: 'Never exercised', cls: 'border-red-300 bg-red-50 text-red-700' },
  overdue:   { label: 'Overdue',         cls: 'border-red-300 bg-red-50 text-red-700' },
  'due-soon':{ label: 'Due soon',        cls: 'border-amber-300 bg-amber-50 text-amber-700' },
  'on-track':{ label: 'On track',        cls: 'border-green-300 bg-green-50 text-green-700' },
}

function cadenceStatus(lastPlayedAt: number | null, cadenceDays: number): CadenceStatus {
  if (lastPlayedAt === null) return 'never'
  const daysSince = (Date.now() - lastPlayedAt) / 86_400_000
  if (daysSince > cadenceDays) return 'overdue'
  if (daysSince > cadenceDays - 14) return 'due-soon'
  return 'on-track'
}

function daysAgoLabel(ms: number | null): string {
  if (ms === null) return '—'
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days === 0) return 'today'
  return `${days}d ago`
}

// /admin/analytics — program-wide session history across every user on the
// install, reusing the same aggregation math the per-user Analytics page uses
// (aggregateGaps/winRate/totalXpEarned/scenarioCoverage), plus a per-user
// exercise-cadence breakdown for compliance tracking.
export function AdminAnalytics() {
  const navigate = useNavigate()
  const [users,    setUsers]    = useState<AdminUserRow[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [cadenceDays, setCadenceDays] = useState(90)
  const [cadenceDraft, setCadenceDraft] = useState('90')
  const [loading,  setLoading]  = useState(true)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [csvBusy, setCsvBusy] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [u, a] = await Promise.all([apiAdmin.listUsers(), apiAdmin.getAnalytics()])
      setUsers(u); setSessions(a.sessions); setCadenceDays(a.cadenceDays); setCadenceDraft(String(a.cadenceDays))
    } catch (e) { setMsg({ kind: 'error', text: (e as Error).message }) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const flash = (kind: 'success' | 'error', text: string) => {
    setMsg({ kind, text })
    setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 4000)
  }

  const saveCadence = async () => {
    const days = Number(cadenceDraft)
    if (!Number.isInteger(days) || days < 1) return flash('error', 'Cadence must be a whole number of days')
    try {
      const r = await apiAdmin.setCadenceDays(days)
      setCadenceDays(r.cadenceDays)
      flash('success', `Exercise cadence set to every ${r.cadenceDays} days`)
    } catch (e) { flash('error', (e as Error).message) }
  }

  const exportCsv = async () => {
    setCsvBusy(true)
    try { await apiAdmin.downloadTeamCsv() }
    catch (e) { flash('error', (e as Error).message) }
    finally { setCsvBusy(false) }
  }

  const gaps     = aggregateGaps(sessions)
  const rate     = winRate(sessions)
  const totalXp  = totalXpEarned(sessions)
  const coverage = scenarioCoverage(sessions)
  const recurringGaps = gaps.filter((g) => g.count >= 2).slice(0, 8)

  // Per-user breakdown: session count, win rate, last exercised, cadence status.
  const perUser = users.map((u) => {
    const mine = sessions.filter((s) => s.ownerUserId === u.id)
    const lastPlayedAt = mine.length > 0 ? Math.max(...mine.map((s) => s.playedAt)) : null
    return {
      user: u,
      sessionCount: mine.length,
      winRate: winRate(mine),
      lastPlayedAt,
      status: cadenceStatus(lastPlayedAt, cadenceDays),
    }
  }).sort((a, b) => (a.lastPlayedAt ?? 0) - (b.lastPlayedAt ?? 0))

  const overdueCount = perUser.filter((u) => u.status === 'overdue' || u.status === 'never').length

  return (
    <div className="min-h-screen bg-gray-50 font-mono">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-xs text-gray-400 hover:text-gray-700 font-semibold tracking-widest uppercase transition-colors">
            ← DICE
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <h1 className="text-sm font-bold tracking-widest text-gray-800 uppercase">Program Analytics — All Users</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{users.length} user{users.length !== 1 ? 's' : ''} · {sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
          <button
            onClick={exportCsv} disabled={csvBusy}
            className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-800 disabled:opacity-40 transition-all"
          >
            {csvBusy ? 'Exporting…' : '⬇ Export Program CSV'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-10">
        {msg && (
          <div className={`rounded border p-3 text-[11px] ${msg.kind === 'success'
            ? 'border-green-300 bg-green-50 text-green-700'
            : 'border-red-300 bg-red-50 text-red-700'}`}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-400">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded border border-gray-200 p-8 text-center text-sm text-gray-500">
            No sessions recorded by anyone on this install yet.
          </div>
        ) : (
          <>
            {/* ── Summary stats ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Sessions Run',      value: sessions.length,          sub: 'across the whole program' },
                { label: 'Program Win Rate',  value: `${rate}%`,                sub: `${sessions.filter((r) => r.outcome === 'victory').length} contained` },
                { label: 'Total XP Earned',   value: totalXp.toLocaleString(),  sub: 'all users combined' },
                { label: 'Scenarios Covered', value: coverage.length,          sub: 'unique scenarios' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-white rounded border border-gray-200 p-4">
                  <div className="text-[10px] text-gray-400 tracking-widest uppercase mb-1">{label}</div>
                  <div className="text-2xl font-bold text-gray-900">{value}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>

            {/* ── Exercise cadence ───────────────────────────────────────── */}
            <section>
              <div className="flex items-baseline gap-3 mb-1">
                <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase">Exercise Cadence</h2>
                {overdueCount > 0 && (
                  <span className="text-[10px] text-red-500 font-semibold">
                    {overdueCount} user{overdueCount !== 1 ? 's' : ''} overdue
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Target: every {cadenceDays} days. Common baseline for periodic IR-testing requirements (PCI-DSS, SOC 2, ISO 27001, NIST CSF) — adjust to match your program's actual policy.
              </p>

              <div className="bg-white rounded border border-gray-200 p-4 mb-4 flex items-center gap-3">
                <label className="text-xs text-gray-500">Cadence target (days):</label>
                <input
                  type="number" min={1} value={cadenceDraft} onChange={(e) => setCadenceDraft(e.target.value)}
                  className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={saveCadence}
                  className="text-xs px-3 py-1.5 rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all"
                >
                  Save
                </button>
              </div>

              <div className="bg-white rounded border border-gray-200 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['User', 'Sessions', 'Win Rate', 'Last Exercised', 'Status'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-500 tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {perUser.map((row) => (
                      <tr key={row.user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-800">{row.user.displayName}</div>
                          <div className="text-[10px] text-gray-400">{row.user.username}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.sessionCount}</td>
                        <td className="px-4 py-3 text-gray-700">{row.sessionCount > 0 ? `${row.winRate}%` : '—'}</td>
                        <td className="px-4 py-3 text-gray-500">{daysAgoLabel(row.lastPlayedAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[9px] font-bold tracking-widest px-2 py-1 rounded border ${CADENCE_STYLE[row.status].cls}`}>
                            {CADENCE_STYLE[row.status].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Program-wide recurring gaps ────────────────────────────── */}
            {recurringGaps.length > 0 && (
              <section>
                <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-1">Program-Wide Recurring Gaps</h2>
                <p className="text-xs text-gray-400 mb-4">Skill areas that keep coming up across the whole team, not just one person.</p>
                <div className="space-y-2">
                  {recurringGaps.map((gap) => (
                    <div key={gap.area} className="bg-white rounded border border-gray-200 px-5 py-3 flex items-center gap-4">
                      <span className={`text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 ${PRIORITY_COLOR[gap.priority]}`}>
                        {gap.priority.toUpperCase()}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 flex-1">{gap.area}</span>
                      <span className="text-xs font-bold text-gray-500">{gap.count} sessions</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Scenario coverage ──────────────────────────────────────── */}
            <section>
              <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-4">Scenario Coverage</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {coverage.map((s) => (
                  <div key={s.scenarioId} className="bg-white rounded border border-gray-200 px-5 py-3.5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">{s.scenarioTitle}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{formatTimestamp(s.lastPlayed).split(',').slice(0, 2).join(',')}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-gray-700">{s.plays}×</div>
                      <div className="text-[9px] text-gray-400">played</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
