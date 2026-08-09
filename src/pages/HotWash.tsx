import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { generateLearningPath, formatDuration, formatTimestamp } from '../utils/learningPath'
import { PROVIDER_LABEL } from '../types/provider'
import { HeadshotAvatar } from '../components/HeadshotAvatar'
import {
  extractActionTriples,
  mechanicalGrade,
  computePlayerGrades,
} from '../utils/actionGrading'
import { callAssessment } from '../engine/assessmentClient'
import type { AssessmentResult } from '../engine/assessmentClient'
import { callOptimalPath } from '../engine/optimalPathClient'
import type { OptimalPathResult } from '../engine/optimalPathClient'
import { ADVERSARY_CLASSES } from '../types/adversary'

const OUTCOME_LABEL: Record<string, string> = {
  victory: 'CONTAINED — Full Containment Achieved',
  partial: 'PARTIAL — Incomplete Containment',
  defeat:  'BREACH — Containment Failed',
}

const GRADE_COLORS: Record<string, string> = {
  'A+': 'bg-green-100 text-green-800 border-green-300',
  'A':  'bg-green-100 text-green-800 border-green-300',
  'A−': 'bg-green-50  text-green-700 border-green-200',
  'B+': 'bg-blue-100  text-blue-800  border-blue-300',
  'B':  'bg-blue-100  text-blue-800  border-blue-300',
  'B−': 'bg-blue-50   text-blue-700  border-blue-200',
  'C+': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'C':  'bg-yellow-100 text-yellow-800 border-yellow-300',
  'C−': 'bg-yellow-50  text-yellow-700 border-yellow-200',
  'D+': 'bg-orange-100 text-orange-800 border-orange-300',
  'D':  'bg-orange-100 text-orange-800 border-orange-300',
  'F':  'bg-red-100   text-red-800   border-red-300',
  '—':  'bg-gray-100  text-gray-500  border-gray-200',
}

function gradeChip(letter: string, size: 'sm' | 'lg' = 'sm') {
  const colors = GRADE_COLORS[letter] ?? 'bg-gray-100 text-gray-500 border-gray-200'
  return size === 'lg'
    ? `inline-block border rounded px-3 py-1 text-2xl font-bold ${colors}`
    : `inline-block border rounded px-1.5 py-0.5 text-xs font-bold ${colors}`
}

export function HotWash() {
  const navigate   = useNavigate()
  const { session, feed, result, providerConfig } = useGameStore()

  const [aiAssessment,  setAiAssessment]  = useState<AssessmentResult | null>(null)
  const [aiLoading,     setAiLoading]     = useState(false)
  const [aiError,       setAiError]       = useState<string | null>(null)

  const [optimalPath,        setOptimalPath]        = useState<OptimalPathResult | null>(null)
  const [optimalPathLoading, setOptimalPathLoading] = useState(false)
  const [optimalPathError,   setOptimalPathError]   = useState<string | null>(null)

  if (!session || !result) {
    navigate('/')
    return null
  }

  const learningPath   = generateLearningPath(feed, session, result)
  const duration       = formatDuration(result.startedAt, result.endedAt)
  const startLabel     = formatTimestamp(result.startedAt)
  const endLabel       = formatTimestamp(result.endedAt)
  const sessionId      = session.id

  const rollEntries    = feed.filter((e) => e.type === 'roll_result')
  const totalRolls     = rollEntries.length
  const successRate    = totalRolls > 0
    ? Math.round(
        (rollEntries.filter((e) =>
          e.outcome === 'success' || e.outcome === 'critical_hit'
        ).length / totalRolls) * 100,
      )
    : 0

  const stagesReached  = session.attackerProgress
  const allStages      = session.scenario.killChainStages

  const actionTriples  = extractActionTriples(feed)
  const playerGrades   = computePlayerGrades(actionTriples, session.players.map((p) => p.name))

  const handleGenerateAssessment = async () => {
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await callAssessment(providerConfig!, session, actionTriples)
      setAiAssessment(result)
    } catch (err) {
      setAiError(String(err))
    } finally {
      setAiLoading(false)
    }
  }

  const handleGenerateOptimalPath = async () => {
    setOptimalPathLoading(true)
    setOptimalPathError(null)
    try {
      const result = await callOptimalPath(providerConfig!, session, actionTriples)
      setOptimalPath(result)
    } catch (err) {
      setOptimalPathError(String(err))
    } finally {
      setOptimalPathLoading(false)
    }
  }

  return (
    <div className="bg-white text-gray-900 min-h-screen font-sans">
      {/* Print / back controls — hidden when printing */}
      <div className="print:hidden sticky top-0 z-10 bg-gray-100 border-b border-gray-300 px-8 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(session.status === 'active' ? '/game' : '/end')}
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          {session.status === 'active' ? '← Return to Session' : '← Back to Summary'}
        </button>
        <div className="flex gap-3">
          {session.status === 'active' && (
            <span className="text-xs text-blue-600 font-semibold self-center px-3 py-1 rounded border border-blue-300 bg-blue-50">
              Provisional Snapshot
            </span>
          )}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded hover:bg-gray-700 transition-colors"
          >
            Print / Export PDF
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-10 space-y-10 print:py-6 print:px-6">

        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <div className="border-b-2 border-gray-900 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-mono tracking-widest text-gray-500 uppercase mb-1">
                DICE — Defensive Incident Containment Exercises
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                Incident Response Tabletop Exercise Report
              </h1>
              <h2 className="text-lg text-gray-600">{session.scenario.title}</h2>
            </div>
            <div className="text-right text-sm text-gray-500 space-y-1 flex-shrink-0 ml-6">
              <div className="font-mono text-xs">SESSION ID</div>
              <div className="font-mono text-xs text-gray-400 break-all max-w-[180px]">{sessionId}</div>
            </div>
          </div>
        </div>

        {/* ── MID-SESSION BANNER (provisional report only) ──────────────── */}
        {session.status === 'active' && (
          <div className="border-2 border-blue-400 bg-blue-50 rounded p-4 flex items-start gap-3">
            <div className="text-blue-500 text-xl flex-shrink-0 mt-0.5">⚑</div>
            <div>
              <div className="font-bold text-blue-800 text-sm mb-0.5">
                Provisional Report — Session In Progress
              </div>
              <div className="text-xs text-blue-700">
                This report was generated mid-exercise via Facilitator Mode. The session has not
                concluded. Metrics, grades, and the learning path reflect current state only.
                Return to the game to continue, or end the session for a final report.
              </div>
            </div>
          </div>
        )}

        {/* ── OUTCOME BANNER ────────────────────────────────────────────── */}
        <div className={`border-2 rounded p-4 text-center font-bold text-xl ${
          result.outcome === 'victory' ? 'border-green-500 bg-green-50 text-green-800' :
          session.status === 'active'  ? 'border-blue-400  bg-blue-50  text-blue-800'  :
          result.outcome === 'partial' ? 'border-yellow-500 bg-yellow-50 text-yellow-800' :
                                          'border-red-500 bg-red-50 text-red-800'
        }`}>
          {session.status === 'active'
            ? `IN PROGRESS — Act ${session.act} of ${session.scenario.acts.length} · Round ${session.round}`
            : OUTCOME_LABEL[result.outcome]}
        </div>

        {/* ── EXERCISE DETAILS ──────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-3">
            Exercise Details
          </h3>
          <table className="w-full border border-gray-200 text-sm">
            <tbody>
              {[
                ['Scenario',            `${session.scenario.id} — ${session.scenario.title}`],
                ['Threat Category',     session.scenario.threatType],
                ['Difficulty Rating',   `${session.scenario.difficulty} / 5`],
                ['Session Mode',        session.mode === 'solo' ? 'Solo' : session.mode === 'adversary' ? `Adversary Mode (${session.players.length} participants)` : `Team (${session.players.length} participants)`],
                ['Timer Pressure',      session.timerDifficulty.charAt(0).toUpperCase() + session.timerDifficulty.slice(1)],
                ['Date Conducted',      startLabel],
                ['Session End',         endLabel],
                ['Total Duration',      duration],
                ['Acts Completed',      `${result.actsCompleted} of ${session.scenario.acts.length}`],
                ['Rounds Played',       String(result.roundsPlayed)],
                ['Scenario Clock Remaining', `${result.clockRemaining} minutes`],
                ['Framework Alignment', 'NIST SP 800-61 Rev.2 / SANS Incident Handling'],
              ].map(([label, value]) => (
                <tr key={label} className="border-b border-gray-100 even:bg-gray-50">
                  <td className="px-4 py-2 font-semibold text-gray-700 w-56">{label}</td>
                  <td className="px-4 py-2 text-gray-900">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── PARTICIPANTS ──────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-3">
            Participants
          </h3>
          <table className="w-full border border-gray-200 text-sm">
            <thead className="bg-gray-100">
              <tr>
                {['', 'Name', 'Role / Class', 'Skills', 'Traits', 'XP Earned'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-semibold text-gray-700 border-b border-gray-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {session.players.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 even:bg-gray-50 align-middle">
                  <td className="px-4 py-3 w-16">
                    <HeadshotAvatar
                      characterClass={p.class}
                      name={p.name}
                      headshot={p.headshot}
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-700">{p.class}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {p.skills.map((s) => `${s.name} (Lvl ${s.level})`).join(', ')}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{p.traits.join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-green-700 font-semibold">
                    +{Math.round(result.xpAwarded / session.players.length)} XP
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ── PERFORMANCE METRICS ───────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-3">
            Performance Metrics
          </h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total Rolls',      value: totalRolls,             sub: 'actions taken' },
              { label: 'Success Rate',     value: `${successRate}%`,      sub: 'rolls ≥ DC' },
              { label: 'Critical Hits',    value: result.criticalHits,    sub: 'natural 20s' },
              { label: 'Critical Fails',   value: result.criticalFails,   sub: 'natural 1s' },
              { label: 'Injects Survived', value: result.injectsSurvived, sub: 'curveballs' },
              { label: 'Hints Used',       value: result.hintsUsed,       sub: result.hintsUsed > 0 ? 'knowledge gaps noted' : 'independent' },
              { label: 'Timer Expiries',   value: result.timerExpiries,   sub: 'rounds over limit' },
              { label: 'XP Awarded',       value: result.xpAwarded,       sub: 'team total' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="border border-gray-200 rounded p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs font-semibold text-gray-700 mt-0.5">{label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── DECISION LOG ──────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-1">
            Decision Log — Mechanical Performance
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Letter grades derived from roll outcomes relative to DC. Reflects execution quality,
            not decision quality. See AI Assessment below for decision-level feedback.
          </p>

          {actionTriples.length === 0 ? (
            <div className="border border-gray-200 rounded p-4 text-gray-500 text-sm">
              No player actions recorded in this session.
            </div>
          ) : (
            <>
              {/* Per-action table */}
              <div className="border border-gray-200 rounded overflow-hidden mb-4">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      {['#', 'Player', 'Action Declared', 'Roll', 'DC', 'Outcome', 'Grade'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {actionTriples.map((t) => {
                      const roll    = t.roll?.roll
                      const outcome = t.roll?.outcome as string | undefined
                      const grade   = outcome ? mechanicalGrade(outcome as never) : null
                      return (
                        <tr key={t.index} className="border-b border-gray-100 even:bg-gray-50 align-top">
                          <td className="px-3 py-2 text-gray-400 font-mono">{t.index + 1}</td>
                          <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">
                            {t.action.speaker}
                          </td>
                          <td className="px-3 py-2 text-gray-700 max-w-[220px]">
                            {t.action.text}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">
                            {roll ? `${roll.raw}+${roll.modifier}=${roll.total}` : '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-600">
                            {roll ? roll.dc : '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {grade ? grade.label : '—'}
                          </td>
                          <td className="px-3 py-2">
                            {grade ? (
                              <span className={gradeChip(grade.letter)}>
                                {grade.letter}
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Per-player summary row */}
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(session.players.length, 4)}, minmax(0, 1fr))` }}>
                {playerGrades.map((pg) => (
                  <div key={pg.playerName} className="border border-gray-200 rounded p-3 text-center">
                    <div className="text-xs font-semibold text-gray-700 truncate mb-2">{pg.playerName}</div>
                    <span className={gradeChip(pg.overallLetter, 'lg')}>{pg.overallLetter}</span>
                    <div className="text-[10px] text-gray-400 mt-2">
                      {pg.actionCount} action{pg.actionCount !== 1 ? 's' : ''} · avg GPA {pg.averageGpa.toFixed(1)}
                    </div>
                    <div className="flex justify-center gap-0.5 mt-2 flex-wrap">
                      {pg.grades.map((g, i) => (
                        <span key={i} className={`text-[9px] font-bold px-1 rounded border ${g.bgColor} ${g.textColor}`}>
                          {g.letter}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* ── AI PERFORMANCE ASSESSMENT ──────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-1">
            AI Performance Assessment
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            AI evaluates decision quality — independent of dice outcomes. Grades reflect
            whether each action was technically appropriate and well-prioritised for the scenario.
          </p>

          {!aiAssessment && (
            <div className="flex items-center gap-4">
              <button
                onClick={handleGenerateAssessment}
                disabled={aiLoading || actionTriples.length === 0}
                className="px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded
                  hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors print:hidden"
              >
                {aiLoading ? 'Generating Assessment…' : 'Generate AI Assessment'}
              </button>
              {aiLoading && (
                <span className="text-xs text-gray-500 animate-pulse">
                  {providerConfig ? PROVIDER_LABEL[providerConfig.provider] : 'AI'} is reviewing {actionTriples.length} decisions…
                </span>
              )}
              {aiError && (
                <span className="text-xs text-red-600">{aiError}</span>
              )}
            </div>
          )}

          {aiAssessment && (
            <div className="space-y-6">
              {/* Team assessment */}
              <div className="border border-gray-200 rounded p-4 bg-gray-50">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Team Assessment</div>
                <p className="text-sm text-gray-800">{aiAssessment.teamAssessment}</p>
              </div>

              {/* Per-player assessments */}
              {aiAssessment.playerAssessments.map((pa) => {
                const colors = GRADE_COLORS[pa.overallGrade] ?? 'bg-gray-100 text-gray-500 border-gray-200'
                return (
                  <div key={pa.playerName} className="border border-gray-200 rounded overflow-hidden">
                    {/* Player header */}
                    <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
                      <span className={`text-2xl font-bold border rounded px-3 py-1 ${colors}`}>
                        {pa.overallGrade}
                      </span>
                      <div>
                        <div className="font-bold text-gray-900">{pa.playerName}</div>
                        <div className="text-xs text-gray-500">{pa.overallAssessment}</div>
                      </div>
                    </div>

                    {/* Per-action feedback */}
                    {pa.actionFeedback.length > 0 && (
                      <table className="w-full text-xs">
                        <thead className="bg-white border-b border-gray-100">
                          <tr>
                            {['Action', 'Declared', 'Tech', 'Priority', 'Feedback'].map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {pa.actionFeedback.map((af) => {
                            const triple = actionTriples[af.actionIndex]
                            return (
                              <tr key={af.actionIndex} className="border-b border-gray-100 even:bg-gray-50 align-top">
                                <td className="px-3 py-2 font-mono text-gray-400">{af.actionIndex + 1}</td>
                                <td className="px-3 py-2 text-gray-700 max-w-[180px]">
                                  {triple?.action.text ?? '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`font-bold ${
                                    af.techScore >= 4 ? 'text-green-700' :
                                    af.techScore >= 3 ? 'text-yellow-700' :
                                    'text-red-700'
                                  }`}>
                                    {af.techScore}/5
                                  </span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`font-bold ${
                                    af.prioScore >= 4 ? 'text-green-700' :
                                    af.prioScore >= 3 ? 'text-yellow-700' :
                                    'text-red-700'
                                  }`}>
                                    {af.prioScore}/5
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-600">{af.note}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}

              <button
                onClick={() => { setAiAssessment(null); setAiError(null) }}
                className="text-xs text-gray-400 hover:text-gray-600 underline print:hidden"
              >
                Regenerate assessment
              </button>
            </div>
          )}
        </section>

        {/* ── OPTIMAL PATH (hidden mid-session to avoid spoilers) ───────── */}
        {session.status !== 'active' && (
          <section>
            <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-1">
              Optimal Response Path
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              AI-derived study guide showing the highest-leverage actions per act for this scenario,
              with notes on where the team's actual response diverged. One defensible expert opinion —
              not the only valid path.
            </p>

            {!optimalPath && (
              <div className="flex items-center gap-4">
                <button
                  onClick={handleGenerateOptimalPath}
                  disabled={optimalPathLoading || actionTriples.length === 0}
                  className="px-5 py-2 bg-gray-900 text-white text-sm font-semibold rounded
                    hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors print:hidden"
                >
                  {optimalPathLoading ? 'Generating Optimal Path…' : 'Generate Optimal Path'}
                </button>
                {optimalPathLoading && (
                  <span className="text-xs text-gray-500 animate-pulse">
                    {providerConfig ? PROVIDER_LABEL[providerConfig.provider] : 'AI'} is mapping the ideal arc…
                  </span>
                )}
                {optimalPathError && (
                  <span className="text-xs text-red-600">{optimalPathError}</span>
                )}
              </div>
            )}

            {optimalPath && (
              <div className="space-y-5">
                {/* Top-level summary */}
                <div className="border border-gray-200 rounded p-4 bg-gray-50">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Ideal Arc
                  </div>
                  <p className="text-sm text-gray-800">{optimalPath.summary}</p>
                </div>

                {/* Per-act blocks */}
                {optimalPath.acts.map((actPath) => (
                  <div key={actPath.actNumber} className="border border-gray-200 rounded overflow-hidden">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">
                          Act {actPath.actNumber}
                        </span>
                        <span className="text-xs text-gray-600 italic truncate">
                          {actPath.primaryObjective}
                        </span>
                      </div>
                    </div>

                    {/* Recommended ordered actions */}
                    <div className="px-4 py-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                        Recommended Sequence
                      </div>
                      <ol className="space-y-2">
                        {actPath.recommendedActions.map((a, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="font-mono text-xs text-gray-400 mt-0.5 flex-shrink-0 w-5">
                              {i + 1}.
                            </span>
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-gray-900 flex items-baseline gap-2 flex-wrap">
                                <span>{a.label}</span>
                                {a.archetype && (
                                  <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-700">
                                    {a.archetype}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 mt-0.5">{a.rationale}</div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Key misses */}
                    {actPath.keyMisses.length > 0 && (
                      <div className="px-4 py-3 border-t border-gray-200 bg-red-50/30">
                        <div className="text-xs font-semibold text-red-700 uppercase tracking-widest mb-2">
                          Key Misses
                        </div>
                        <ul className="space-y-3">
                          {actPath.keyMisses.map((miss, i) => (
                            <li key={i} className="text-xs text-gray-700 flex gap-2">
                              <span className="text-red-500 flex-shrink-0 mt-0.5">✗</span>
                              <span className="leading-relaxed">{miss}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}

                {/* Caveats */}
                <p className="text-xs text-gray-400 italic">
                  {optimalPath.caveats}
                </p>

                <button
                  onClick={() => { setOptimalPath(null); setOptimalPathError(null) }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline print:hidden"
                >
                  Regenerate optimal path
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── ATTACKER PROGRESSION ──────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-3">
            Attacker Kill Chain Progression
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {allStages.map((stage, idx) => {
              const reached  = stagesReached.includes(stage)
              const isFinal  = stage === result.finalAttackerStage
              return (
                <div key={stage} className="flex items-center gap-2">
                  <div className={`px-3 py-1.5 rounded border text-xs font-semibold ${
                    isFinal && result.outcome !== 'victory'
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : reached
                      ? 'border-orange-300 bg-orange-50 text-orange-700'
                      : 'border-green-300 bg-green-50 text-green-700'
                  }`}>
                    {stage.replace(/_/g, ' ')}
                    {isFinal && result.outcome === 'victory' && ' ✓'}
                    {isFinal && result.outcome !== 'victory' && ' ✗'}
                  </div>
                  {idx < allStages.length - 1 && (
                    <span className="text-gray-300">→</span>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            <span className="inline-block w-3 h-3 rounded bg-orange-50 border border-orange-300 mr-1" />
            Attacker reached &nbsp;
            <span className="inline-block w-3 h-3 rounded bg-green-50 border border-green-300 mr-1 ml-2" />
            Not reached / contained
          </p>
        </section>

        {/* ── ADVERSARY PERFORMANCE (adversary mode only) ───────────────── */}
        {session.mode === 'adversary' && session.adversary && (() => {
          const adv      = session.adversary
          const advClass = ADVERSARY_CLASSES.find((c) => c.id === adv.adversaryClass)
          const advPlayer = session.players.find((p) => p.id === adv.playerId)
          const evaded   = adv.rollHistory.filter((r) => r.evaded).length
          const detected = adv.rollHistory.filter((r) => !r.evaded).length
          const total    = adv.rollHistory.length
          const evasionRate = total > 0 ? Math.round((evaded / total) * 100) : 0
          return (
            <section key="adversary-perf">
              <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-3">
                Adversary Performance — {advClass?.name ?? adv.adversaryClass}
              </h3>
              <div className="border-2 border-red-200 rounded overflow-hidden">
                <div className="bg-red-50 px-4 py-3 border-b border-red-200 flex items-center gap-4">
                  <span className="text-2xl">{advClass?.glyph}</span>
                  <div>
                    <div className="font-bold text-red-800">{advPlayer?.name ?? 'Adversary'}</div>
                    <div className="text-xs text-red-600">{advClass?.name} · {advClass?.playstyle}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-sm font-bold text-red-800">
                      Final Stealth: {adv.stealthScore}/100
                    </div>
                    <div className="text-xs text-red-600">
                      {adv.stealthScore >= 70 ? 'Ghost — nearly undetected'
                        : adv.stealthScore >= 40 ? 'Partially exposed'
                        : 'Fully burned — defenders found the trail'}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 divide-x divide-red-100 bg-white">
                  {[
                    { label: 'Tactics Executed', value: total },
                    { label: 'Evasion Rate',     value: `${evasionRate}%` },
                    { label: 'Objectives Met',   value: adv.objectivesCompleted.length },
                    { label: 'Times Detected',   value: detected },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-4 py-3 text-center">
                      <div className="text-xl font-bold text-red-700">{value}</div>
                      <div className="text-xs text-gray-500">{label}</div>
                    </div>
                  ))}
                </div>
                {adv.rollHistory.length > 0 && (
                  <div className="border-t border-red-100">
                    <table className="w-full text-xs">
                      <thead className="bg-red-50">
                        <tr>
                          {['Round', 'Action', 'Roll', 'DC', 'Result', 'Stage'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-red-700 border-b border-red-100">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {adv.rollHistory.map((r, i) => (
                          <tr key={i} className="border-b border-red-50 even:bg-red-50/30">
                            <td className="px-3 py-1.5 text-gray-500">{r.round}</td>
                            <td className="px-3 py-1.5 text-gray-700 max-w-[220px] truncate">{r.action}</td>
                            <td className="px-3 py-1.5 font-mono text-red-800">{r.total}</td>
                            <td className="px-3 py-1.5 text-gray-500">{r.detectionDC}</td>
                            <td className={`px-3 py-1.5 font-semibold ${r.evaded ? 'text-green-700' : 'text-red-700'}`}>
                              {r.evaded ? 'EVADED' : 'DETECTED'}
                            </td>
                            <td className="px-3 py-1.5 text-gray-500 capitalize">
                              {r.stageAdvanced?.replace(/_/g, ' ') ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="px-4 py-3 bg-gray-50 border-t border-red-100">
                  <div className="text-xs font-semibold text-gray-600 mb-1">Special Ability</div>
                  <div className="text-xs text-gray-500">◆ {advClass?.specialAbility}</div>
                </div>
              </div>
            </section>
          )
        })()}

        {/* ── ATT&CK TECHNIQUE COVERAGE ─────────────────────────────────── */}
        {(() => {
          const techniques: { id: string; name: string }[] = []
          const seen = new Set<string>()
          for (const act of session.scenario.acts) {
            for (const clue of act.clues) {
              if (clue.techniqueId && !seen.has(clue.techniqueId)) {
                seen.add(clue.techniqueId)
                techniques.push({ id: clue.techniqueId, name: clue.techniqueName ?? clue.techniqueId })
              }
            }
          }
          if (techniques.length === 0) return null
          return (
            <section>
              <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-1">
                MITRE ATT&amp;CK Techniques Encountered
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Techniques embedded in scenario clues. Use these as a study guide — each one represents a real adversary behaviour your team faced.
              </p>
              <div className="flex flex-wrap gap-2">
                {techniques.map(({ id, name }) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 border border-blue-200 bg-blue-50 rounded px-3 py-1.5"
                  >
                    <span className="font-mono text-xs font-bold text-blue-700">{id}</span>
                    <span className="text-xs text-blue-900">{name}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">
                {techniques.length} unique technique{techniques.length !== 1 ? 's' : ''} across {session.scenario.acts.length} act{session.scenario.acts.length !== 1 ? 's' : ''}
              </p>
            </section>
          )
        })()}

        {/* ── SESSION TIMELINE (Audit Log) ──────────────────────────────── */}
        <section>
          <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-3">
            Session Timeline — Audit Log
          </h3>
          <div className="border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  {['#', 'Type', 'Speaker', 'Entry'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 border-b border-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feed.map((entry, i) => (
                  <tr key={entry.id} className="border-b border-gray-100 even:bg-gray-50 align-top">
                    <td className="px-3 py-2 text-gray-400 font-mono w-8">{i + 1}</td>
                    <td className="px-3 py-2 w-28">
                      <span className={`font-mono font-semibold ${
                        entry.type === 'dm_narration'  ? 'text-green-700' :
                        entry.type === 'player_action' ? 'text-blue-700'  :
                        entry.type === 'roll_result'   ? 'text-yellow-700':
                        entry.type === 'inject'        ? 'text-red-700'   :
                        entry.type === 'hint'          ? 'text-purple-700':
                                                         'text-gray-500'
                      }`}>
                        {entry.type.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 w-32 font-mono">{entry.speaker}</td>
                    <td className="px-3 py-2 text-gray-800 leading-relaxed">
                      {entry.type === 'roll_result' && entry.roll
                        ? `Roll ${entry.roll.raw} + ${entry.roll.modifier} mod = ${entry.roll.total} vs DC ${entry.roll.dc} — ${entry.roll.outcome.replace(/_/g, ' ').toUpperCase()}`
                        : entry.text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── LEARNING PATH ─────────────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-1">
            Recommended Learning Path
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Generated from session performance. Gaps are derived from attacker kill chain progression,
            roll outcomes, hint usage, and timer expiry patterns.
          </p>
          {learningPath.length === 0 ? (
            <div className="border border-green-300 bg-green-50 rounded p-4 text-green-800 text-sm">
              No significant gaps identified. Team demonstrated strong incident response capability across all observed phases.
            </div>
          ) : (
            <div className="space-y-4">
              {learningPath.map((item, i) => (
                <div key={i} className="border border-gray-200 rounded overflow-hidden">
                  <div className={`flex items-center justify-between px-4 py-2 border-b ${
                    item.priority === 'critical' ? 'bg-red-50 border-red-200'    :
                    item.priority === 'high'     ? 'bg-yellow-50 border-yellow-200' :
                    item.priority === 'medium'   ? 'bg-blue-50 border-blue-200'  :
                                                    'bg-green-50 border-green-200'
                  }`}>
                    <span className="font-bold text-sm text-gray-900">{item.area}</span>
                    <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                      item.priority === 'critical' ? 'bg-red-100 text-red-700'    :
                      item.priority === 'high'     ? 'bg-yellow-100 text-yellow-700' :
                      item.priority === 'medium'   ? 'bg-blue-100 text-blue-700'  :
                                                      'bg-green-100 text-green-700'
                    }`}>{item.priority}</span>
                  </div>
                  <div className="px-4 py-3 space-y-2 bg-white">
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Gap Identified: </span>
                      <span className="text-sm text-gray-800">{item.gapIdentified}</span>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Recommendation: </span>
                      <span className="text-sm text-gray-800">{item.recommendation}</span>
                    </div>
                    <div className="text-xs text-gray-400 font-mono">{item.nistRef}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── SCENARIO OBJECTIVES ───────────────────────────────────────── */}
        <section>
          <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-3">
            Scenario Objectives
          </h3>
          <table className="w-full border border-gray-200 text-sm">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-4 py-2 font-semibold text-gray-700 w-48">Victory Condition</td>
                <td className="px-4 py-2 text-gray-900">{session.scenario.victoryCondition}</td>
                <td className="px-4 py-2 w-24 text-right">
                  <span className={`text-xs font-bold ${result.outcome === 'victory' ? 'text-green-700' : 'text-red-600'}`}>
                    {result.outcome === 'victory' ? 'MET ✓' : 'NOT MET ✗'}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-semibold text-gray-700">Failure Condition</td>
                <td className="px-4 py-2 text-gray-900">{session.scenario.failureCondition}</td>
                <td className="px-4 py-2 text-right">
                  <span className={`text-xs font-bold ${result.outcome === 'defeat' ? 'text-red-600' : 'text-green-700'}`}>
                    {result.outcome === 'defeat' ? 'TRIGGERED ✗' : 'AVOIDED ✓'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ── ATTESTATION ───────────────────────────────────────────────── */}
        <section className="border-t-2 border-gray-900 pt-6">
          <h3 className="text-sm font-bold tracking-widest text-gray-500 uppercase mb-4">
            Facilitator Attestation
          </h3>
          <p className="text-xs text-gray-500 mb-6">
            This document certifies that the above-named participants completed the DICE tabletop incident
            response exercise as described. The session was conducted in a simulated environment using the
            DICE platform (AI-assisted scenario engine) and does not represent a live incident.
            This record may be retained as evidence of security awareness and incident response training
            for audit, compliance, or certification purposes.
          </p>
          <div className="grid grid-cols-2 gap-8">
            {[
              { label: 'Facilitator Name', lines: 1 },
              { label: 'Organization',     lines: 1 },
              { label: 'Signature',        lines: 1 },
              { label: 'Date Signed',      lines: 1 },
            ].map(({ label }) => (
              <div key={label}>
                <div className="text-xs font-semibold text-gray-600 mb-1">{label}</div>
                <div className="border-b border-gray-400 h-8" />
              </div>
            ))}
          </div>

          <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-gray-400 font-mono space-y-0.5">
            <div>Session ID: {sessionId}</div>
            <div>Conducted: {startLabel} — {endLabel}</div>
            <div>Duration: {duration}</div>
            <div>Generated by DICE v0.1 — Defensive Incident Containment Exercises</div>
            <div>AI Engine: {providerConfig ? `${providerConfig.model} (${PROVIDER_LABEL[providerConfig.provider]})` : 'Not configured'} — Scenario narration and adjudication</div>
          </div>
        </section>

      </div>
    </div>
  )
}
