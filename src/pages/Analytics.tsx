import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { aggregateGaps, winRate, totalXpEarned, scenarioCoverage } from '../utils/gapAnalysis'
import { levelForXp, xpToNextLevel } from '../utils/leveling'
import { formatTimestamp } from '../utils/learningPath'
import { api } from '../api/client'
import type { LearningPriority } from '../types/game'
import { computeGradeTrend } from '../utils/trendAnalysis'
import { TrendChart } from '../components/TrendChart'
import { aggregateTraitUsage } from '../utils/traitUsage'
import { techniqueCoverageGaps } from '../utils/techniqueCoverage'
import { useCampaignStore } from '../store/campaignStore'
import { isCampaignCertifiable } from '../utils/campaignCertificate'
import { CampaignCertificateButton } from '../components/CampaignCertificateButton'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<LearningPriority, { bar: string; badge: string; text: string }> = {
  critical: { bar: 'bg-red-500',    badge: 'border-red-300 bg-red-50 text-red-700',    text: 'text-red-700' },
  high:     { bar: 'bg-orange-500', badge: 'border-orange-300 bg-orange-50 text-orange-700', text: 'text-orange-700' },
  medium:   { bar: 'bg-amber-400',  badge: 'border-amber-300 bg-amber-50 text-amber-700',  text: 'text-amber-700' },
  low:      { bar: 'bg-blue-400',   badge: 'border-blue-300 bg-blue-50 text-blue-700',   text: 'text-blue-700' },
}

const OUTCOME_STYLE: Record<string, string> = {
  victory: 'border-green-300 bg-green-50 text-green-700',
  partial: 'border-amber-300 bg-amber-50 text-amber-700',
  defeat:  'border-red-300 bg-red-50 text-red-700',
}

const OUTCOME_LABEL: Record<string, string> = {
  victory: 'CONTAINED',
  partial: 'PARTIAL',
  defeat:  'BREACH',
}

const DIFFICULTY_DOTS = (d: number) => '●'.repeat(d) + '○'.repeat(5 - d)

function timeAgo(ms: number): string {
  const diff  = Date.now() - ms
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Analytics() {
  const navigate = useNavigate()
  const { sessionHistory, roster, clearHistory } = useGameStore()
  // Certificates are issued only for campaigns that were actually played to the
  // end — see isCampaignCertifiable; a status flipped by hand doesn't qualify.
  const completedCampaigns = useCampaignStore((s) => s.campaigns).filter(isCampaignCertifiable)

  const [confirmClear, setConfirmClear] = useState(false)
  const [expandedGap,  setExpandedGap]  = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [showAllTechniqueGaps, setShowAllTechniqueGaps] = useState(false)

  const download = async (id: string | null, fn: () => Promise<void>) => {
    setDownloadError(null); setBusyId(id)
    try { await fn() }
    catch (e) { setDownloadError((e as Error).message) }
    finally { setBusyId(null) }
  }

  const gaps     = aggregateGaps(sessionHistory)
  const rate     = winRate(sessionHistory)
  const totalXp  = totalXpEarned(sessionHistory)
  const coverage = scenarioCoverage(sessionHistory)

  const recurringGaps = gaps.filter((g) => g.count >= 2)
  const watchGaps     = gaps.filter((g) => g.count === 1)
  const maxCount      = gaps.length > 0 ? Math.max(...gaps.map((g) => g.count)) : 1

  const gradeTrend  = computeGradeTrend(sessionHistory)
  const traitUsage  = aggregateTraitUsage(sessionHistory)
  const techGaps    = techniqueCoverageGaps(sessionHistory)
  const visibleTechniqueGaps = showAllTechniqueGaps ? techGaps.gaps : techGaps.gaps.slice(0, 24)

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (sessionHistory.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 font-mono flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4 opacity-30">📊</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">No Session History Yet</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            Complete a scenario session to start tracking skill gaps and team performance over time.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded border border-gray-300 text-gray-600 text-sm font-semibold
              hover:border-gray-400 hover:text-gray-800 transition-all"
          >
            ← Back to DICE
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 font-mono">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-gray-400 hover:text-gray-700 font-semibold tracking-widest uppercase transition-colors"
          >
            ← DICE
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <h1 className="text-sm font-bold tracking-widest text-gray-800 uppercase">Team Analytics</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{sessionHistory.length} session{sessionHistory.length !== 1 ? 's' : ''} recorded</span>
          <button
            onClick={() => download('csv', () => api.downloadSessionHistoryCsv())}
            disabled={busyId === 'csv'}
            className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-800 disabled:opacity-40 transition-all"
          >
            {busyId === 'csv' ? 'Exporting…' : '⬇ Export CSV'}
          </button>
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600">Clear all history?</span>
              <button
                onClick={() => { clearHistory(); setConfirmClear(false) }}
                className="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-all"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="text-xs text-gray-400 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-xs text-gray-300 hover:text-red-400 transition-colors"
            >
              Clear history
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-10">

        {downloadError && (
          <div className="rounded border border-red-200 bg-red-50 text-red-700 text-xs px-4 py-2.5">
            {downloadError}
          </div>
        )}

        {/* ── Summary stats ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Sessions Run',       value: sessionHistory.length,            sub: 'total' },
            { label: 'Win Rate',           value: `${rate}%`,                        sub: `${sessionHistory.filter(r => r.outcome === 'victory').length} contained` },
            { label: 'Total XP Earned',    value: totalXp.toLocaleString(),          sub: 'across all sessions' },
            { label: 'Scenarios Covered',  value: coverage.length,                   sub: 'unique scenarios' },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white rounded border border-gray-200 p-4">
              <div className="text-[10px] text-gray-400 tracking-widest uppercase mb-1">{label}</div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Grade trend ─────────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-1">
            Decision Grade Trend
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Session-wide average grade (GPA) over time — the clearest read on whether the team is
            actually improving, not just winning or losing. Dot color is the session outcome.
          </p>
          <div className="bg-white rounded border border-gray-200 p-4">
            <TrendChart points={gradeTrend} />
          </div>
        </section>

        {/* ── Trait & ability usage ───────────────────────────────────────────── */}
        {traitUsage.length > 0 && (
          <section>
            <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-1">
              Trait &amp; Ability Usage
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              How often each character trait has actually mattered across your session history.
            </p>
            <div className="flex flex-wrap gap-2">
              {traitUsage.map(({ trait, count }) => (
                <div
                  key={trait}
                  className="flex items-center gap-2 border border-purple-200 bg-purple-50 rounded px-3 py-1.5"
                >
                  <span className="text-xs font-semibold text-purple-900">{trait}</span>
                  <span className="text-[10px] font-mono text-purple-600">×{count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Recurring skill gaps ────────────────────────────────────────────── */}
        <section>
          <div className="flex items-baseline gap-3 mb-1">
            <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase">
              Recurring Skill Gaps
            </h2>
            {recurringGaps.length > 0 && (
              <span className="text-[10px] text-red-500 font-semibold">
                {recurringGaps.length} area{recurringGaps.length !== 1 ? 's' : ''} appeared in 2+ sessions
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Areas where the team has consistently struggled — highest priority training targets.
          </p>

          {recurringGaps.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded p-4 text-sm text-green-700">
              No recurring gaps yet. Run more sessions to identify patterns.
            </div>
          ) : (
            <div className="space-y-3">
              {recurringGaps.map((gap) => {
                const colors    = PRIORITY_COLOR[gap.priority]
                const barWidth  = Math.round((gap.count / maxCount) * 100)
                const expanded  = expandedGap === gap.area

                return (
                  <div
                    key={gap.area}
                    className="bg-white rounded border border-gray-200 overflow-hidden"
                  >
                    <button
                      className="w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedGap(expanded ? null : gap.area)}
                    >
                      <div className="flex items-center gap-4 mb-2.5">
                        <span className={`text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded border ${colors.badge}`}>
                          {gap.priority.toUpperCase()}
                        </span>
                        <span className="text-sm font-semibold text-gray-800 flex-1">{gap.area}</span>
                        <span className={`text-xs font-bold tabular-nums ${colors.text}`}>
                          {gap.count} session{gap.count !== 1 ? 's' : ''}
                        </span>
                        <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${colors.bar}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1.5">
                        Last seen {timeAgo(gap.lastSeen)} · {gap.nistRef}
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-5 pb-4 border-t border-gray-100 bg-gray-50">
                        <p className="text-xs text-gray-600 leading-relaxed pt-3">{gap.recommendation}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Watch areas (single-session gaps) ──────────────────────────────── */}
        {watchGaps.length > 0 && (
          <section>
            <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-1">
              Watch Areas
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Gaps identified once — not yet recurring, but worth monitoring.
            </p>
            <div className="flex flex-wrap gap-2">
              {watchGaps.map((gap) => {
                const colors = PRIORITY_COLOR[gap.priority]
                return (
                  <div
                    key={gap.area}
                    title={gap.recommendation}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs ${colors.badge}`}
                  >
                    <span className="font-semibold">{gap.area}</span>
                    <span className="opacity-60 text-[10px]">· {gap.priority}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Session history ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-4">
            Session History
          </h2>
          <div className="space-y-2">
            {sessionHistory.map((record) => (
              <div
                key={record.id}
                className="bg-white rounded border border-gray-200 px-5 py-3.5 flex items-center gap-5"
              >
                {/* Outcome badge */}
                <span className={`text-[9px] font-bold tracking-widest px-2 py-1 rounded border flex-shrink-0 ${OUTCOME_STYLE[record.outcome]}`}>
                  {OUTCOME_LABEL[record.outcome]}
                </span>

                {/* Scenario */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{record.scenarioTitle}</div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-gray-400 font-mono">{record.scenarioId}</span>
                    <span className="text-[10px] text-gray-300">{DIFFICULTY_DOTS(record.difficulty)}</span>
                    <span className="text-[10px] text-gray-400">
                      {record.playerCount} player{record.playerCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {record.players.map((p) => p.name).join(', ')}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-5 text-right flex-shrink-0">
                  <div>
                    <div className="text-xs font-bold text-gray-700">{record.result.roundsPlayed}</div>
                    <div className="text-[9px] text-gray-400">rounds</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-green-600">+{record.result.xpAwarded}</div>
                    <div className="text-[9px] text-gray-400">XP</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-700">{record.result.criticalHits}H / {record.result.criticalFails}F</div>
                    <div className="text-[9px] text-gray-400">crits</div>
                  </div>
                </div>

                {/* Date */}
                <div className="text-right flex-shrink-0 hidden lg:block">
                  <div className="text-[10px] text-gray-400">{timeAgo(record.playedAt)}</div>
                  <div className="text-[9px] text-gray-300">{formatTimestamp(record.playedAt).split(',').slice(0, 2).join(',')}</div>
                </div>

                {/* Export */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => download(`pdf-${record.id}`, () => api.downloadSessionReport(record.id))}
                    disabled={busyId === `pdf-${record.id}`}
                    title="Download after-action report (PDF)"
                    className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-700 disabled:opacity-40 transition-all"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => download(`json-${record.id}`, () => api.downloadSessionJson(record.id))}
                    disabled={busyId === `json-${record.id}`}
                    title="Download raw session record (JSON)"
                    className="text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-400 hover:border-gray-400 hover:text-gray-700 disabled:opacity-40 transition-all"
                  >
                    JSON
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Scenario coverage ───────────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-4">
            Scenario Coverage
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {coverage.map((s) => (
              <div key={s.scenarioId} className="bg-white rounded border border-gray-200 px-5 py-3.5 flex items-center gap-4">
                <span className={`text-[9px] font-bold tracking-widest px-2 py-1 rounded border flex-shrink-0 ${OUTCOME_STYLE[s.bestOutcome]}`}>
                  {OUTCOME_LABEL[s.bestOutcome]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{s.scenarioTitle}</div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-gray-400 font-mono">{s.scenarioId}</span>
                    <span className="text-[10px] text-gray-300">{DIFFICULTY_DOTS(s.difficulty)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-gray-700">{s.plays}×</div>
                  <div className="text-[9px] text-gray-400">played</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── MITRE technique coverage gaps ───────────────────────────────────── */}
        <section>
          <div className="flex items-baseline gap-3 mb-1">
            <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase">
              Technique Coverage Gaps
            </h2>
            <span className="text-[10px] text-gray-400 font-semibold">
              {techGaps.covered} / {techGaps.total} MITRE ATT&amp;CK techniques encountered
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            Techniques that appear somewhere in the scenario library but this team has never faced.
            Hover a gap to see which scenarios would cover it.
          </p>
          {techGaps.gaps.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded p-4 text-sm text-green-700">
              Full coverage — every technique in the library has been encountered at least once.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {visibleTechniqueGaps.map((t) => (
                  <div
                    key={t.id}
                    title={`Covered by: ${t.scenarioTitles.slice(0, 5).join(', ')}${t.scenarioTitles.length > 5 ? `, +${t.scenarioTitles.length - 5} more` : ''}`}
                    className="flex items-center gap-2 border border-gray-200 bg-white rounded px-3 py-1.5"
                  >
                    <span className="font-mono text-xs font-bold text-gray-500">{t.id}</span>
                    <span className="text-xs text-gray-700">{t.name}</span>
                  </div>
                ))}
              </div>
              {techGaps.gaps.length > 24 && (
                <button
                  onClick={() => setShowAllTechniqueGaps((v) => !v)}
                  className="text-[10px] text-gray-400 hover:text-gray-700 underline mt-3"
                >
                  {showAllTechniqueGaps ? 'Show fewer' : `Show all ${techGaps.gaps.length} gaps`}
                </button>
              )}
            </>
          )}
        </section>

        {/* ── Campaign certificates ──────────────────────────────────────────── */}
        {completedCampaigns.length > 0 && (
          <section>
            <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-1">
              Campaign Certificates
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Campaigns played through to the last scenario. Each certificate is a PNG recording the
              scenarios, their difficulty, and the hours of gameplay behind them.
            </p>
            <div className="bg-white rounded border border-gray-200 divide-y divide-gray-100">
              {completedCampaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{c.name || 'Untitled Campaign'}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {c.scenarioSequence.length} scenario{c.scenarioSequence.length === 1 ? '' : 's'}
                      {' · completed '}
                      {formatTimestamp(Math.max(...c.scenarioResults.map((r) => r.completedAt)))}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <CampaignCertificateButton campaign={c} variant="light" label="⬇ Certificate" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Character progress ─────────────────────────────────────────────── */}
        {roster.length > 0 && (
          <section>
            <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-4">
              Character Progress
            </h2>
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Character', 'Class', 'Level', 'XP', 'To Next Level', 'Skills', 'Traits'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-500 tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {roster.map((char) => {
                    const lvl        = levelForXp(char.xp)
                    const { needed, next } = xpToNextLevel(char.xp)
                    return (
                      <tr key={char.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-gray-800">{char.name}</td>
                        <td className="px-4 py-3 text-gray-500">{char.class}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-gray-900">{lvl}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-700">{char.xp.toLocaleString()}</td>
                        <td className="px-4 py-3 text-gray-400">
                          {next === null ? (
                            <span className="text-green-600 font-semibold">MAX</span>
                          ) : (
                            <div>
                              <div className="text-[10px] mb-1">{needed} XP needed</div>
                              <div className="h-1 w-20 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-green-400 rounded-full"
                                  style={{ width: `${Math.max(5, 100 - Math.round((needed / next) * 100))}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {char.skills.map((s) => (
                              <span
                                key={s.name}
                                className="text-[9px] px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600"
                              >
                                {s.name} {s.level}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {char.traits.length === 0 ? (
                              <span className="text-gray-300">—</span>
                            ) : char.traits.map((t) => (
                              <span
                                key={t}
                                className="text-[9px] px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-600"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
