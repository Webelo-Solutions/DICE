import { benchWarnings } from '../utils/departmentalReport'
import type { DepartmentalReport, ParticipantScorecard } from '../types/report'

const ENGAGEMENT_STYLE: Record<ParticipantScorecard['engagement'], string> = {
  active:   'bg-green-100 text-green-800',
  moderate: 'bg-yellow-100 text-yellow-800',
  low:      'bg-red-100 text-red-800',
}

const pct = (n: number | null) => n === null ? '—' : `${Math.round(n * 100)}%`

// The departmental half of the after-action report. HotWash is a light,
// print-oriented document, so this matches that treatment rather than the
// terminal styling used in play.
export function DepartmentalReportSection({ report }: { report: DepartmentalReport }) {
  const warnings = benchWarnings(report.bench)

  return (
    <div className="space-y-8">

      {/* ── What the session cost in people-time, and what came back ── */}
      <section>
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Participation Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: 'Participants',    value: report.totals.participants },
            { label: 'Turns Taken',     value: report.totals.turnsTaken },
            { label: 'Turns Forfeited', value: report.totals.turnsForfeited },
            { label: 'Suggestions',     value: report.totals.suggestionsOffered },
            { label: 'Acted On',        value: report.totals.suggestionsAdopted },
          ].map((s) => (
            <div key={s.label} className="border border-gray-200 rounded p-3 text-center">
              <div className="text-2xl font-bold text-gray-900 tabular-nums">{s.value}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bench depth: the finding a training manager acts on ── */}
      <section>
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-1">Bench Depth</h3>
        <p className="text-xs text-gray-500 mb-3">
          Whether each capability has real depth, or one capable person and a queue behind them.
        </p>

        {warnings.length > 0 && (
          <ul className="mb-3 space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                {w}
              </li>
            ))}
          </ul>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[560px]">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                {['Role', 'Staffed', 'Own character', 'Standard sheet', 'Never acted', 'Turns', 'Success', 'Levels'].map((h) => (
                  <th key={h} className="text-left font-semibold px-2 py-1.5 border-b border-gray-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.bench.map((row) => (
                <tr key={row.role} className={row.unstaffed ? 'bg-red-50' : ''}>
                  <td className="px-2 py-1.5 border-b border-gray-100 font-medium text-gray-900">{row.role}</td>
                  {row.unstaffed ? (
                    <td colSpan={7} className="px-2 py-1.5 border-b border-gray-100 text-red-700">
                      Unstaffed — skipped every round; this capability was absent from the incident.
                    </td>
                  ) : (
                    <>
                      <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums">{row.staffed}</td>
                      <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums">{row.onOwnCharacter}</td>
                      <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums">{row.onTemplate}</td>
                      <td className={`px-2 py-1.5 border-b border-gray-100 tabular-nums ${row.neverActed > 0 ? 'text-amber-700 font-semibold' : ''}`}>
                        {row.neverActed}
                      </td>
                      <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums">{row.turnsTaken}</td>
                      <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums">{pct(row.successRate)}</td>
                      <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums text-gray-500">
                        {row.lowestLevel === row.highestLevel ? row.highestLevel : `${row.lowestLevel}–${row.highestLevel}`}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Per-person scorecards ── */}
      <section>
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-1">Individual Scorecards</h3>
        <p className="text-xs text-gray-500 mb-3">
          Ordered by contribution. <span className="font-medium">Drawn</span> is how often the rotation reached
          someone; <span className="font-medium">Taken</span> is how often they acted on it. Engagement reflects
          what each person contributed, not time spent on the page.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                {['Participant', 'Role', 'Department', 'Drawn', 'Taken', 'Rolls', 'Success', 'Crit', 'Advice', 'Used', 'Drops', 'XP', 'Engagement'].map((h) => (
                  <th key={h} className="text-left font-semibold px-2 py-1.5 border-b border-gray-200 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.scorecards.map((s) => (
                <tr key={s.participantId}>
                  <td className="px-2 py-1.5 border-b border-gray-100">
                    <span className="font-medium text-gray-900">{s.displayName}</span>
                    {s.usesTemplate && (
                      <span className="ml-1.5 text-[10px] text-gray-400" title="Acted on the role's standard sheet — earns no personal XP">
                        standard sheet
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-700">{s.gameRole ?? '—'}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-gray-500">{s.departmentName ?? '—'}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums">{s.timesDrawn}</td>
                  <td className={`px-2 py-1.5 border-b border-gray-100 tabular-nums ${s.turnsForfeited > 0 ? 'text-amber-700' : ''}`}>
                    {s.turnsTaken}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums">{s.rolls}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums">
                    {s.rolls > 0 ? pct(s.successes / s.rolls) : '—'}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums text-gray-500">
                    {s.criticalHits > 0 || s.criticalFails > 0 ? `${s.criticalHits}/${s.criticalFails}` : '—'}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums">{s.suggestionsOffered}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums">{s.suggestionsAdopted}</td>
                  <td className={`px-2 py-1.5 border-b border-gray-100 tabular-nums ${s.disconnects > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                    {s.disconnects}
                  </td>
                  <td className="px-2 py-1.5 border-b border-gray-100 tabular-nums">{s.usesTemplate ? '—' : s.xpEarned}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${ENGAGEMENT_STYLE[s.engagement]}`}>
                      {s.engagement}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
          This section records named individual participation. Confirm it meets your own HR, works-council and
          data-protection obligations before circulating it outside the exercise.
        </p>
      </section>
    </div>
  )
}
