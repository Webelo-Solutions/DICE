import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { CharacterCard } from '../components/CharacterCard'
import { ALL_SKILLS } from '../data/skills'
import { TRAIT_DEFINITIONS } from '../data/traitDefinitions'
import type { Character, CharacterClass, CharacterStats, Skill, SkillName, StatKey, TraitName } from '../types/game'

const CLASSES: { name: CharacterClass; desc: string; primaryStats: StatKey[] }[] = [
  { name: 'Analyst',      desc: 'Eyes on glass. Fast triage, broad SIEM coverage.',            primaryStats: ['vigilance', 'analysis'] },
  { name: 'Hunter',       desc: 'Finds what no one else sees. TTP tracking, hypothesis-driven.', primaryStats: ['stealth', 'analysis'] },
  { name: 'Responder',    desc: 'Built for chaos. Containment, isolation, timeline control.',   primaryStats: ['agility', 'fortitude'] },
  { name: 'Engineer',     desc: 'Tool wielder. Deploys countermeasures, scripts the solution.', primaryStats: ['analysis', 'agility'] },
  { name: 'Intel Officer','desc': 'Context machine. Attribution, OSINT, threat actor profiling.',primaryStats: ['stealth', 'command'] },
  { name: 'Commander',    desc: 'Keeps the ship steady. Stakeholder bridge, escalation owner.', primaryStats: ['command', 'fortitude'] },
]

// Derived from traitDefinitions.ts (the single source of truth for trait
// copy) so this list can never drift from what the trait actually does.
const ALL_TRAITS: { name: TraitName; desc: string }[] =
  Object.values(TRAIT_DEFINITIONS).map((t) => ({ name: t.name, desc: t.mechanicalEffect }))

const STAT_KEYS: StatKey[] = ['vigilance', 'agility', 'analysis', 'fortitude', 'stealth', 'command']
const STAT_LABELS: Record<StatKey, string> = {
  vigilance: 'Vigilance', agility: 'Agility', analysis: 'Analysis',
  fortitude: 'Fortitude', stealth: 'Stealth', command: 'Command',
}

const STAT_DESC: Record<StatKey, string> = {
  vigilance: 'Detection, alerting, spotting attacker TTPs',
  agility:   'Timer bonuses, speed of action execution',
  analysis:  'Log review, forensic investigation, pattern recognition',
  fortitude: 'Absorbing bad rolls, resisting pressure penalties',
  stealth:   'Investigating without tipping off the attacker',
  command:   'Stakeholder communication, escalation, team coordination',
}

const BUDGET = 15
const MIN_STAT = 1
const MAX_STAT = 5

export function CharacterCreate() {
  const navigate = useNavigate()
  const { addCharacter, roster } = useGameStore()

  const [step, setStep] = useState<'class' | 'stats' | 'skills' | 'traits' | 'name'>('class')
  const [name, setName]             = useState('')
  const [charClass, setCharClass]   = useState<CharacterClass | null>(null)
  const [stats, setStats]           = useState<CharacterStats>({
    vigilance: 2, agility: 2, analysis: 2, fortitude: 2, stealth: 2, command: 2,
  })
  const [skills, setSkills]         = useState<SkillName[]>([])
  const [trait, setTrait]           = useState<TraitName | null>(null)

  const spent = Object.values(stats).reduce((a, b) => a + b, 0)
  const remaining = BUDGET - spent

  const adjustStat = (key: StatKey, delta: number) => {
    setStats((prev) => {
      const next = prev[key] + delta
      if (next < MIN_STAT || next > MAX_STAT) return prev
      if (delta > 0 && remaining <= 0) return prev
      return { ...prev, [key]: next }
    })
  }

  const toggleSkill = (name: SkillName) => {
    setSkills((prev) =>
      prev.includes(name)
        ? prev.filter((s) => s !== name)
        : prev.length < 3 ? [...prev, name] : prev
    )
  }

  const buildCharacter = (): Character => ({
    id:     crypto.randomUUID(),
    name:   name.trim() || 'Agent',
    class:  charClass!,
    stats,
    skills: skills.map((s) => ({ name: s, level: 1 }) as Skill),
    traits: trait ? [trait] : [],
    level:  1,
    xp:     0,
  })

  const preview = charClass ? buildCharacter() : null

  const canAdvance = {
    class:  charClass !== null,
    stats:  remaining === 0,
    skills: skills.length === 3,
    traits: trait !== null,
    name:   name.trim().length > 0,
  }

  return (
    <div className="min-h-screen bg-terminal-bg p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/roster')}
          className="text-xs text-terminal-dim hover:text-terminal-green mb-6 block transition-colors"
        >
          ← Back to Roster
        </button>

        <div className="flex gap-8">
          {/* Main form */}
          <div className="flex-1 space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">CREATE CHARACTER</h1>
              <div className="flex gap-2 text-xs text-terminal-dim">
                {(['class','stats','skills','traits','name'] as const).map((s, i) => (
                  <span key={s} className={`${step === s ? 'text-terminal-green font-semibold' : ''}`}>
                    {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
                    {i < 4 && <span className="ml-2 text-terminal-muted">·</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* Step: Class */}
            {step === 'class' && (
              <div className="space-y-2">
                <p className="text-sm text-terminal-dim mb-4">Choose your role archetype.</p>
                {CLASSES.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setCharClass(c.name)}
                    className={`w-full text-left p-3 rounded border transition-all ${
                      charClass === c.name
                        ? 'border-terminal-green bg-terminal-green/5 text-white'
                        : 'border-terminal-border bg-terminal-surface text-gray-400 hover:border-terminal-dim'
                    }`}
                  >
                    <div className="font-semibold text-sm">{c.name}</div>
                    <div className="text-xs text-terminal-dim mt-0.5">{c.desc}</div>
                    <div className="text-[10px] text-terminal-dim mt-1">
                      Primary: {c.primaryStats.map((s) => STAT_LABELS[s]).join(', ')}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step: Stats */}
            {step === 'stats' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-terminal-dim">Distribute {BUDGET} stat points.</p>
                  <span className={`text-sm font-bold ${remaining === 0 ? 'text-terminal-green' : remaining < 0 ? 'text-terminal-red' : 'text-terminal-amber'}`}>
                    {remaining} remaining
                  </span>
                </div>
                {STAT_KEYS.map((key) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-24 flex-shrink-0">
                      <div className="text-xs font-semibold text-gray-300">{STAT_LABELS[key]}</div>
                      <div className="text-[10px] text-terminal-dim">{STAT_DESC[key]}</div>
                    </div>
                    <button onClick={() => adjustStat(key, -1)} className="w-6 h-6 rounded border border-terminal-border text-terminal-dim hover:text-white text-sm flex items-center justify-center">−</button>
                    <span className={`w-6 text-center font-bold text-sm ${stats[key] >= 4 ? 'text-terminal-green' : 'text-white'}`}>{stats[key]}</span>
                    <button onClick={() => adjustStat(key, +1)} className="w-6 h-6 rounded border border-terminal-border text-terminal-dim hover:text-white text-sm flex items-center justify-center">+</button>
                    <div className="flex gap-0.5">
                      {Array.from({ length: MAX_STAT }).map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-sm ${i < stats[key] ? 'bg-terminal-green' : 'bg-terminal-muted'}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step: Skills */}
            {step === 'skills' && (
              <div className="space-y-2">
                <p className="text-sm text-terminal-dim mb-4">
                  Choose 3 skills. ({skills.length}/3 selected)
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_SKILLS.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleSkill(s)}
                      className={`p-2 text-left rounded border text-sm transition-all ${
                        skills.includes(s)
                          ? 'border-terminal-green bg-terminal-green/5 text-white'
                          : 'border-terminal-border bg-terminal-surface text-gray-400 hover:border-terminal-dim'
                      } ${skills.length >= 3 && !skills.includes(s) ? 'opacity-40' : ''}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step: Traits */}
            {step === 'traits' && (
              <div className="space-y-2">
                <p className="text-sm text-terminal-dim mb-4">Choose 1 starting trait.</p>
                {ALL_TRAITS.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => setTrait(t.name)}
                    className={`w-full text-left p-3 rounded border transition-all ${
                      trait === t.name
                        ? 'border-terminal-green bg-terminal-green/5 text-white'
                        : 'border-terminal-border bg-terminal-surface text-gray-400 hover:border-terminal-dim'
                    }`}
                  >
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-xs text-terminal-dim mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Step: Name */}
            {step === 'name' && (
              <div className="space-y-4">
                <p className="text-sm text-terminal-dim">What do they call you in the SOC?</p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Agent name..."
                  maxLength={24}
                  className="w-full bg-terminal-surface border border-terminal-green/40 focus:border-terminal-green
                    text-white font-mono px-4 py-3 rounded focus:outline-none text-sm placeholder-terminal-dim"
                  autoFocus
                />
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-2">
              {step !== 'class' && (
                <button
                  onClick={() => {
                    const steps = ['class','stats','skills','traits','name'] as const
                    setStep(steps[steps.indexOf(step) - 1])
                  }}
                  className="px-4 py-2 text-xs font-semibold tracking-widest uppercase border border-terminal-border text-terminal-dim hover:text-white rounded transition-all"
                >
                  Back
                </button>
              )}
              {step !== 'name' ? (
                <button
                  onClick={() => {
                    const steps = ['class','stats','skills','traits','name'] as const
                    setStep(steps[steps.indexOf(step) + 1])
                  }}
                  disabled={!canAdvance[step]}
                  className="px-4 py-2 text-xs font-semibold tracking-widest uppercase
                    bg-terminal-green/10 border border-terminal-green/40 text-terminal-green
                    hover:bg-terminal-green/20 hover:border-terminal-green
                    disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all"
                >
                  Next →
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!charClass) return
                    addCharacter(buildCharacter())
                    navigate('/roster')
                  }}
                  disabled={!canAdvance.name}
                  className="px-4 py-2 text-xs font-semibold tracking-widest uppercase
                    bg-terminal-green/20 border border-terminal-green text-terminal-green
                    hover:bg-terminal-green/30 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all"
                >
                  Add to Roster
                </button>
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="w-56 flex-shrink-0">
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-2">Preview</div>
            {preview ? (
              <CharacterCard character={{ ...preview, name: name || 'Agent' }} />
            ) : (
              <div className="rounded border border-terminal-border bg-terminal-surface p-4 text-center text-terminal-dim text-xs">
                Select a class to preview
              </div>
            )}
            <div className="mt-4 text-xs text-terminal-dim">
              Roster: {roster.length}/4
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
