import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { ADVERSARY_CLASSES } from '../types/adversary'
import type { AdversaryClass } from '../types/adversary'
import type { TimerDifficulty } from '../types/game'
import { TIMER_DIFFICULTY_SECONDS } from '../types/game'

const DIFFICULTIES: { value: TimerDifficulty; label: string; desc: string }[] = [
  { value: 'rookie',  label: 'Rookie',    desc: '3 min' },
  { value: 'analyst', label: 'Analyst',   desc: '2 min' },
  { value: 'senior',  label: 'Senior',    desc: '90 sec' },
  { value: 'elite',   label: 'Elite',     desc: '60 sec' },
  { value: 'none',    label: 'No Timer',  desc: '∞' },
]

export function AdversarySetup() {
  const navigate          = useNavigate()
  const { roster, session, initSession } = useGameStore()

  const selectedScenario  = session?.scenario ?? null

  const [selectedClass,      setSelectedClass]      = useState<AdversaryClass>('apt_actor')
  const [adversaryPlayerId,  setAdversaryPlayerId]  = useState<string>(roster[0]?.id ?? '')
  const [difficulty,         setDifficulty]         = useState<TimerDifficulty>('analyst')

  if (!selectedScenario) {
    navigate('/scenarios')
    return null
  }

  const classDef   = ADVERSARY_CLASSES.find((c) => c.id === selectedClass)!
  const defenders  = roster.filter((c) => c.id !== adversaryPlayerId)
  const canLaunch  = adversaryPlayerId && defenders.length >= 1 && roster.length >= 2

  const timerSecs = difficulty === 'none' ? 0 : TIMER_DIFFICULTY_SECONDS[difficulty]
  const timerLabel = timerSecs >= 60 ? `${timerSecs / 60} min` : timerSecs > 0 ? `${timerSecs}s` : 'No timer'

  const handleLaunch = () => {
    if (!canLaunch) return
    initSession(
      selectedScenario,
      roster,
      'adversary',
      difficulty,
      adversaryPlayerId,
      selectedClass,
    )
    navigate('/game')
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Back */}
        <button
          onClick={() => navigate('/roster')}
          className="text-xs text-terminal-dim hover:text-terminal-green mb-6 block transition-colors"
        >
          ← Back to Roster
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] text-terminal-red tracking-widest uppercase
              border border-terminal-red/40 bg-terminal-red/10 px-2 py-0.5 rounded">
              Adversary Mode
            </span>
            <span className="text-terminal-dim text-xs">
              {selectedScenario.title}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">THREAT ACTOR SELECTION</h1>
          <p className="text-sm text-terminal-dim mt-1">
            One player takes the role of the attacker. Defenders must contain the threat before the kill chain completes.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: class selection */}
          <div className="lg:col-span-2 space-y-3">
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-3">
              Threat Actor Class
            </div>

            {ADVERSARY_CLASSES.map((cls) => {
              const isSelected = selectedClass === cls.id
              return (
                <button
                  key={cls.id}
                  onClick={() => setSelectedClass(cls.id)}
                  className={`w-full text-left rounded-lg border p-4 transition-all duration-150 ${
                    isSelected
                      ? `${cls.borderColor} ${cls.bgColor}`
                      : 'border-terminal-border bg-terminal-surface hover:border-terminal-dim'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-2xl flex-shrink-0 ${isSelected ? cls.color : 'text-terminal-dim'}`}>
                      {cls.glyph}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-bold ${isSelected ? cls.color : 'text-white'}`}>
                          {cls.name}
                        </span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                i < cls.aggressionTier
                                  ? isSelected ? cls.color.replace('text-', 'bg-') : 'bg-terminal-dim'
                                  : 'bg-terminal-border'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[9px] text-terminal-dim/60">aggression</span>
                      </div>
                      <p className="text-xs text-terminal-dim leading-relaxed mb-2">
                        {cls.description}
                      </p>
                      <div className="text-[10px] text-terminal-dim/70 italic leading-snug mb-1.5">
                        Playstyle: {cls.playstyle}
                      </div>
                      <div className={`text-[10px] font-semibold ${isSelected ? cls.color : 'text-terminal-dim'}`}>
                        ◆ {cls.specialAbility}
                      </div>
                    </div>
                    <div className={`flex-shrink-0 w-4 h-4 rounded-full border flex items-center justify-center
                      transition-all ${isSelected ? 'border-current bg-current' : 'border-terminal-border'}`}
                      style={{ color: isSelected ? undefined : undefined }}>
                      {isSelected && <span className="text-[8px] text-black font-black">✓</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Right: config panel */}
          <div className="space-y-6">

            {/* Adversary player picker */}
            <div>
              <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-3">
                Who Plays Adversary?
              </div>
              {roster.length < 2 ? (
                <div className="rounded border border-terminal-amber/30 bg-terminal-amber/5 p-3">
                  <p className="text-xs text-terminal-amber">
                    Adversary Mode requires at least 2 characters — one attacker and one defender.
                  </p>
                  <button
                    onClick={() => navigate('/create')}
                    className="text-xs text-terminal-green hover:underline mt-1"
                  >
                    Add a character →
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {roster.map((c) => {
                    const isAdversary = c.id === adversaryPlayerId
                    return (
                      <button
                        key={c.id}
                        onClick={() => setAdversaryPlayerId(c.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded border text-left
                          transition-all text-xs ${
                          isAdversary
                            ? 'border-terminal-red/50 bg-terminal-red/10 text-white'
                            : 'border-terminal-border bg-terminal-surface text-terminal-dim hover:border-terminal-dim'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full border flex items-center justify-center flex-shrink-0 ${
                          isAdversary ? 'border-terminal-red bg-terminal-red' : 'border-terminal-border'
                        }`}>
                          {isAdversary && <span className="text-[7px] text-white font-black">●</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{c.name}</div>
                          <div className="text-[10px] opacity-60">{c.class}</div>
                        </div>
                        {isAdversary ? (
                          <span className="text-[9px] text-terminal-red tracking-widest">ADVERSARY</span>
                        ) : (
                          <span className="text-[9px] text-terminal-green/60 tracking-widest">DEFENDER</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Timer */}
            <div>
              <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-3">
                Defender Round Timer
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDifficulty(d.value)}
                    className={`py-1.5 px-1 rounded border text-center transition-all text-[10px] ${
                      difficulty === d.value
                        ? 'border-terminal-green bg-terminal-green/10 text-terminal-green'
                        : 'border-terminal-border bg-terminal-surface text-terminal-dim hover:border-terminal-dim'
                    }`}
                  >
                    <div className="font-semibold">{d.label}</div>
                    <div className="opacity-60">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Kill chain preview */}
            <div>
              <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-2">
                Kill Chain to Defeat Defenders
              </div>
              <div className="space-y-1">
                {selectedScenario.killChainStages.map((stage, i) => (
                  <div key={stage} className="flex items-center gap-2 text-[10px]">
                    <span className="text-terminal-dim/40 w-3 text-right">{i + 1}</span>
                    <div className={`flex-1 px-2 py-0.5 rounded ${
                      i === 0
                        ? 'bg-terminal-red/20 text-terminal-red/80'
                        : i === selectedScenario.killChainStages.length - 1
                        ? 'bg-terminal-red/30 text-terminal-red font-semibold'
                        : 'bg-terminal-surface text-terminal-dim'
                    }`}>
                      {stage.replace(/_/g, ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Launch */}
            <div className="pt-2 border-t border-terminal-border">
              {defenders.length === 0 && roster.length >= 2 && (
                <p className="text-xs text-terminal-amber/80 mb-3">
                  Select a different adversary — at least one defender required.
                </p>
              )}
              <button
                onClick={handleLaunch}
                disabled={!canLaunch}
                className="w-full py-3 rounded border border-terminal-red/60 bg-terminal-red/10
                  text-terminal-red font-bold text-sm tracking-widest uppercase
                  hover:bg-terminal-red/20 hover:border-terminal-red
                  disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {classDef.glyph} Deploy Threat Actor
              </button>
              <p className="text-[9px] text-terminal-dim/50 text-center mt-2">
                {defenders.length} defender{defenders.length !== 1 ? 's' : ''} · {timerLabel} round timer
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
