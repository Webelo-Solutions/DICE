import { useState } from 'react'
import { ALL_SCENARIOS } from '../data/scenarios'
import { CATEGORIES, getCategoryDef } from '../data/categories'
import { useGameStore } from '../store/gameStore'
import { useCampaignStore } from '../store/campaignStore'
import { generateCampaign, rerollSlot, newSeed } from '../utils/campaignGenerator'
import type { GeneratorOptions, GeneratedSlot } from '../utils/campaignGenerator'
import { SectionTitle, Field, inputCls, labelCls } from './formAtoms'
import { DIFFICULTY_LABELS } from '../types/game'

const DIFF_COLOR = ['', 'text-terminal-green', 'text-terminal-blue', 'text-terminal-amber', 'text-orange-400', 'text-terminal-red']

const fmtHours = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`

interface Props {
  /** Hands the finished sequence to the campaign being edited. */
  onApply: (scenarioIds: string[]) => void
  onCancel: () => void
}

// Builds a playable sequence from a handful of constraints, so a facilitator
// gets a credible campaign in seconds rather than hand-picking from 144
// scenarios. The draw is seeded and shown before it is committed — a generator
// whose output you cannot inspect or adjust is a slot machine, not a tool.
export function CampaignGeneratorPanel({ onApply, onCancel }: Props) {
  const sessionHistory  = useGameStore((s) => s.sessionHistory)
  const customScenarios = useCampaignStore((s) => s.customScenarios)
  const catalogue = [...ALL_SCENARIOS, ...customScenarios]

  const [count,         setCount]         = useState(10)
  const [categories,    setCategories]    = useState<string[]>([])
  const [minDifficulty, setMinDifficulty] = useState(1)
  const [maxDifficulty, setMaxDifficulty] = useState(5)
  const [totalBudget,   setTotalBudget]   = useState<string>('')
  const [perSessionCap, setPerSessionCap] = useState<string>('')
  const [preferNovel,   setPreferNovel]   = useState(true)
  const [seed,          setSeed]          = useState(newSeed)
  const [slots,         setSlots]         = useState<GeneratedSlot[] | null>(null)
  const [notes,         setNotes]         = useState<string[]>([])

  const options = (): GeneratorOptions => ({
    count,
    categories,
    minDifficulty: Math.min(minDifficulty, maxDifficulty),
    maxDifficulty: Math.max(minDifficulty, maxDifficulty),
    totalBudget:   totalBudget.trim()   ? Number(totalBudget)   : null,
    perSessionCap: perSessionCap.trim() ? Number(perSessionCap) : null,
    preferNovel,
    seed,
  })

  const run = (withSeed: string) => {
    const result = generateCampaign(catalogue, sessionHistory, { ...options(), seed: withSeed })
    setSeed(withSeed)
    setSlots(result.slots)
    setNotes(result.notes)
  }

  const toggleCategory = (id: string) =>
    setCategories((cs) => cs.includes(id) ? cs.filter((c) => c !== id) : [...cs, id])

  const totalMinutes = (slots ?? []).reduce((n, s) => n + s.scenario.estimatedMinutes, 0)
  const overBudget = totalBudget.trim() ? totalMinutes > Number(totalBudget) : false

  return (
    <div className="space-y-6 pb-10">
      <div>
        <SectionTitle>Generate a Campaign</SectionTitle>
        <p className="text-[11px] text-terminal-dim leading-relaxed mb-4">
          Draws a sequence from the {catalogue.length}-scenario library and orders it as a ramp —
          short fundamentals first, the demanding set pieces last. Review it before applying;
          nothing is saved until you do.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="How many scenarios">
            <input className={inputCls} type="number" min={1} max={40} value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} />
          </Field>
          <Field label="Seed">
            <div className="flex gap-2">
              <input className={inputCls} value={seed} onChange={(e) => setSeed(e.target.value.toUpperCase())} />
              <button type="button" onClick={() => setSeed(newSeed())}
                title="New seed"
                className="px-3 rounded border border-terminal-border text-terminal-dim text-xs
                  hover:border-terminal-green hover:text-terminal-green transition-colors">↻</button>
            </div>
          </Field>
          <Field label="Easiest difficulty">
            <select className={inputCls} value={minDifficulty} onChange={(e) => setMinDifficulty(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} — {DIFFICULTY_LABELS[d]}</option>)}
            </select>
          </Field>
          <Field label="Hardest difficulty">
            <select className={inputCls} value={maxDifficulty} onChange={(e) => setMaxDifficulty(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d} — {DIFFICULTY_LABELS[d]}</option>)}
            </select>
          </Field>
          <Field label="Total time budget (min)">
            <input className={inputCls} type="number" min={0} value={totalBudget} placeholder="no limit"
              onChange={(e) => setTotalBudget(e.target.value)} />
          </Field>
          <Field label="Longest single session (min)">
            <input className={inputCls} type="number" min={0} value={perSessionCap} placeholder="no limit"
              onChange={(e) => setPerSessionCap(e.target.value)} />
          </Field>
        </div>

        <div className="mb-4">
          <label className={labelCls}>
            Categories <span className="text-terminal-dim/50 normal-case tracking-normal">
              — none selected draws from all
            </span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const on = categories.includes(cat.id)
              return (
                <button key={cat.id} type="button" onClick={() => toggleCategory(cat.id)}
                  aria-pressed={on}
                  className={`text-[10px] px-2 py-1 rounded border transition-colors ${on
                    ? `${cat.borderColor} ${cat.bgColor} ${cat.textColor}`
                    : 'border-terminal-border text-terminal-dim hover:border-terminal-dim'}`}>
                  {cat.glyph} {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        <label className="flex items-start gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={preferNovel} onChange={(e) => setPreferNovel(e.target.checked)}
            className="mt-0.5 accent-terminal-green" />
          <span className="text-[11px] text-terminal-dim leading-relaxed">
            Favour unfamiliar ground — prefers scenarios covering MITRE techniques this team has never
            met, and avoids ones already played, based on your session history.
          </span>
        </label>

        <button type="button" onClick={() => run(seed)}
          className="w-full py-2.5 rounded border border-terminal-green bg-terminal-green/10
            text-terminal-green text-sm font-bold tracking-widest uppercase hover:bg-terminal-green/20 transition-colors">
          {slots ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {notes.length > 0 && (
        <div className="rounded border border-terminal-amber/40 bg-terminal-amber/5 px-3 py-2 space-y-1">
          {notes.map((n, i) => <p key={i} className="text-[11px] text-terminal-amber leading-relaxed">{n}</p>)}
        </div>
      )}

      {slots && slots.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <SectionTitle>Proposed Sequence</SectionTitle>
            <span className={`text-[10px] tabular-nums ${overBudget ? 'text-terminal-amber' : 'text-terminal-dim'}`}>
              {slots.length} scenarios · {fmtHours(totalMinutes)}
            </span>
          </div>

          <div className="space-y-1 mb-4">
            {slots.map((slot, i) => {
              const cat = getCategoryDef(slot.scenario.category ?? '')
              return (
                <div key={`${slot.scenario.id}-${i}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded border border-terminal-border
                    bg-terminal-surface/40">
                  <span className="text-[10px] text-terminal-dim w-5 text-right flex-shrink-0 tabular-nums">{i + 1}</span>
                  <span className={`text-[10px] w-16 flex-shrink-0 ${DIFF_COLOR[slot.scenario.difficulty]}`}>
                    {DIFFICULTY_LABELS[slot.scenario.difficulty]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white truncate">{slot.scenario.title}</div>
                    <div className="text-[10px] text-terminal-dim truncate">
                      {slot.scenario.id} · <span className={cat.textColor}>{cat.label}</span>
                      {preferNovel && slot.novelTechniques > 0 && (
                        <span className="text-terminal-green"> · {slot.novelTechniques} new technique{slot.novelTechniques === 1 ? '' : 's'}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-terminal-dim flex-shrink-0 tabular-nums w-12 text-right">
                    {slot.scenario.estimatedMinutes}m
                  </span>
                  <button type="button"
                    onClick={() => setSlots(rerollSlot(catalogue, slots, i, options()))}
                    title="Swap this one for another at the same difficulty"
                    className="text-[10px] text-terminal-dim hover:text-terminal-green transition-colors flex-shrink-0">
                    ↻
                  </button>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onApply(slots.map((s) => s.scenario.id))}
              className="flex-1 py-2.5 rounded border border-terminal-green bg-terminal-green/10
                text-terminal-green text-sm font-bold tracking-widest uppercase hover:bg-terminal-green/20 transition-colors">
              Use This Sequence
            </button>
            <button type="button" onClick={onCancel}
              className="px-4 py-2.5 rounded border border-terminal-border text-terminal-dim text-sm
                hover:border-terminal-dim hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {slots && slots.length === 0 && (
        <button type="button" onClick={onCancel}
          className="w-full py-2.5 rounded border border-terminal-border text-terminal-dim text-sm
            hover:border-terminal-dim hover:text-white transition-colors">
          Cancel
        </button>
      )}
    </div>
  )
}
