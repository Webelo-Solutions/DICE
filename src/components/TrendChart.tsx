import type { TrendPoint } from '../utils/trendAnalysis'

// No charting library in this project (see package.json) — a line + dots SVG
// is simple enough to hand-roll rather than pull in a dependency for one chart.
interface Props {
  points: TrendPoint[]
  height?: number
}

const OUTCOME_DOT: Record<string, string> = {
  victory: '#16a34a', // green-600
  partial: '#d97706', // amber-600
  defeat:  '#dc2626', // red-600
}

const MAX_GPA = 4.3 // matches the critical_hit grade cap in actionGrading.ts

export function TrendChart({ points, height = 120 }: Props) {
  if (points.length < 2) {
    return (
      <div className="text-xs text-gray-400 italic py-6 text-center border border-gray-100 rounded bg-gray-50">
        Play a few more sessions to see a trend — need at least 2 graded sessions.
      </div>
    )
  }

  const width  = 600
  const padX   = 14
  const padY   = 14
  const innerW = width - padX * 2
  const innerH = height - padY * 2

  const xFor = (i: number) => padX + (i / (points.length - 1)) * innerW
  const yFor = (gpa: number) => padY + innerH - (Math.min(gpa, MAX_GPA) / MAX_GPA) * innerH

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.gpa).toFixed(1)}`).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
        {[1, 2, 3, 4].map((g) => (
          <line key={g} x1={padX} x2={width - padX} y1={yFor(g)} y2={yFor(g)} stroke="#f3f4f6" strokeWidth={1} />
        ))}
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2} />
        {points.map((p, i) => (
          <circle
            key={p.sessionId}
            cx={xFor(i)}
            cy={yFor(p.gpa)}
            r={4}
            fill={OUTCOME_DOT[p.outcome] ?? '#9ca3af'}
            stroke="white"
            strokeWidth={1.5}
          >
            <title>{`${p.scenarioTitle} — GPA ${p.gpa.toFixed(2)} (${p.outcome}) — ${new Date(p.playedAt).toLocaleDateString()}`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1.5">
        <span>{new Date(points[0].playedAt).toLocaleDateString()}</span>
        <div className="flex items-center gap-3">
          {(['victory', 'partial', 'defeat'] as const).map((o) => (
            <span key={o} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: OUTCOME_DOT[o] }} />
              {o === 'victory' ? 'Contained' : o === 'partial' ? 'Partial' : 'Breach'}
            </span>
          ))}
        </div>
        <span>{new Date(points[points.length - 1].playedAt).toLocaleDateString()}</span>
      </div>
    </div>
  )
}
