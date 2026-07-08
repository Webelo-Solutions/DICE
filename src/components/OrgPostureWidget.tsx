import type { OrgState } from '../types/orgState'

interface Props {
  orgState: OrgState
}

function PostureBar({ value }: { value: number }) {
  const color =
    value >= 70 ? 'bg-terminal-green'  :
    value >= 45 ? 'bg-terminal-amber'  :
                  'bg-terminal-red'

  const label =
    value >= 70 ? 'Hardened'    :
    value >= 45 ? 'Degraded'    :
                  'Critical'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-terminal-dim">Security Posture</span>
        <span className={`font-bold ${
          value >= 70 ? 'text-terminal-green' :
          value >= 45 ? 'text-terminal-amber' :
                        'text-terminal-red'
        }`}>
          {label} · {value}/100
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-terminal-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export function OrgPostureWidget({ orgState }: Props) {
  if (orgState.sessionsPlayed === 0) return null

  const severeCount       = orgState.orgComplications.filter((c) => c.severity === 'severe').length
  const activeCompromises = orgState.persistentCompromises.length
  const lastEntry = orgState.sessionLedger[orgState.sessionLedger.length - 1]

  return (
    <div className="rounded border border-terminal-border bg-terminal-surface p-4 space-y-4 font-mono">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-terminal-dim tracking-widest uppercase">
            Org Threat Posture
          </div>
          <div className="text-[10px] text-terminal-dim/50 mt-0.5">
            {orgState.sessionsPlayed} session{orgState.sessionsPlayed !== 1 ? 's' : ''} on record
          </div>
        </div>
        {(severeCount > 0 || activeCompromises > 0) && (
          <span className="text-[10px] px-2 py-0.5 rounded border border-terminal-red/40
            bg-terminal-red/10 text-terminal-red font-semibold tracking-widest uppercase">
            ⚠ {severeCount + activeCompromises} active
          </span>
        )}
      </div>

      <PostureBar value={orgState.securityPosture} />

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className={`text-lg font-bold ${
            orgState.orgComplications.length > 0 ? 'text-terminal-amber' : 'text-terminal-dim'
          }`}>
            {orgState.orgComplications.length}
          </div>
          <div className="text-[9px] text-terminal-dim/60 uppercase tracking-widest">Carry-over</div>
        </div>
        <div>
          <div className={`text-lg font-bold ${
            activeCompromises > 0 ? 'text-terminal-red' : 'text-terminal-dim'
          }`}>
            {activeCompromises}
          </div>
          <div className="text-[9px] text-terminal-dim/60 uppercase tracking-widest">Compromised</div>
        </div>
        <div>
          <div className="text-lg font-bold text-terminal-blue">
            {orgState.identifiedTTPs.length}
          </div>
          <div className="text-[9px] text-terminal-dim/60 uppercase tracking-widest">TTPs Known</div>
        </div>
      </div>

      {orgState.orgComplications.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] text-terminal-dim/50 uppercase tracking-widest">Active org complications</div>
          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
            {orgState.orgComplications.slice(-4).map((c) => (
              <div key={c.id} className="flex items-start gap-2">
                <span className={`text-[9px] mt-0.5 flex-shrink-0 font-bold ${
                  c.severity === 'severe'   ? 'text-terminal-red'   :
                  c.severity === 'moderate' ? 'text-terminal-amber' :
                                              'text-terminal-dim'
                }`}>
                  {c.severity === 'severe' ? '●●' : c.severity === 'moderate' ? '●○' : '○○'}
                </span>
                <span className="text-[10px] text-gray-400 leading-snug">
                  {c.name.replace(/_/g, ' ')}
                  <span className="text-terminal-dim/40 ml-1">— {c.sourceScenarioTitle}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastEntry && (
        <div className="border-t border-terminal-border pt-3">
          <div className="text-[9px] text-terminal-dim/50 uppercase tracking-widest mb-1">Last session</div>
          <p className="text-[10px] text-gray-400 leading-snug">{lastEntry.impact}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[9px] font-semibold ${
              lastEntry.outcome === 'victory' ? 'text-terminal-green' :
              lastEntry.outcome === 'partial' ? 'text-terminal-amber' :
                                                'text-terminal-red'
            }`}>
              {lastEntry.outcome.toUpperCase()}
            </span>
            <span className={`text-[9px] font-mono ${
              lastEntry.postureChange > 0 ? 'text-terminal-green/70' : 'text-terminal-red/70'
            }`}>
              {lastEntry.postureChange > 0 ? '+' : ''}{lastEntry.postureChange} posture
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
