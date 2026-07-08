import { useEffect, useRef, useState } from 'react'

// ─── Scenario Clock ───────────────────────────────────────────────────────────

interface ScenarioClockProps {
  totalMinutes:     number
  remainingMinutes: number
}

export function ScenarioClock({ totalMinutes, remainingMinutes }: ScenarioClockProps) {
  const pct = Math.max(0, remainingMinutes / totalMinutes)
  const color =
    pct > 0.5 ? 'bg-terminal-green' :
    pct > 0.25 ? 'bg-terminal-amber' :
    'bg-terminal-red'
  const textColor =
    pct > 0.5 ? 'text-terminal-green' :
    pct > 0.25 ? 'text-terminal-amber' :
    'text-terminal-red'

  const hours = Math.floor(remainingMinutes / 60)
  const mins  = Math.floor(remainingMinutes % 60)
  const label = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-mono text-terminal-dim tracking-widest uppercase">Scenario Clock</span>
        <span className={`text-xs font-mono font-bold ${textColor}`}>{label}</span>
      </div>
      <div className="h-1.5 bg-terminal-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}

// ─── Round Timer ──────────────────────────────────────────────────────────────

interface RoundTimerProps {
  seconds:   number
  running:   boolean
  onExpire:  () => void
}

export function RoundTimer({ seconds, running, onExpire }: RoundTimerProps) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const expiredRef  = useRef(false)

  useEffect(() => {
    setRemaining(seconds)
    expiredRef.current = false
  }, [seconds])

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          if (!expiredRef.current) {
            expiredRef.current = true
            onExpire()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, onExpire])

  const pct    = remaining / seconds
  const urgent = remaining <= 15
  const color  = urgent ? 'text-terminal-red' : remaining <= 30 ? 'text-terminal-amber' : 'text-terminal-green'
  const barColor = urgent ? 'bg-terminal-red' : remaining <= 30 ? 'bg-terminal-amber' : 'bg-terminal-green'

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-mono text-terminal-dim tracking-widest uppercase">Round Timer</span>
        <span className={`text-xs font-mono font-bold tabular-nums ${color} ${urgent ? 'animate-pulse' : ''}`}>
          {remaining}s
        </span>
      </div>
      <div className="h-1.5 bg-terminal-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  )
}
