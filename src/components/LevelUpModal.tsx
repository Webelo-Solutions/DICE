import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  availableSkillUpgrades,
  availableNewTraits,
  availableStatIncreases,
} from '../utils/leveling'
import type { LevelUpEvent, LevelUpChoice } from '../utils/leveling'
import type { Character } from '../types/game'
import { TRAIT_DEFINITIONS } from '../data/traitDefinitions'

const STAT_LABEL: Record<string, string> = {
  vigilance: 'Vigilance', agility: 'Agility', analysis: 'Analysis',
  fortitude: 'Fortitude', stealth: 'Stealth', command: 'Command',
}

// Shared skill/trait/stat upgrade picker. Used by solo's SessionEnd (shown
// immediately, wrapped in AnimatePresence there) and by RosterPage (shown on
// demand for a room-hosted session's deferred level-up).
export function LevelUpModal({
  event,
  character,
  onConfirm,
}: {
  event: LevelUpEvent
  character: Character
  onConfirm: (choice: LevelUpChoice) => void
}) {
  const [selected, setSelected] = useState<LevelUpChoice | null>(null)
  const skillChoices = availableSkillUpgrades(character)
  const traitChoices = availableNewTraits(character)
  const statChoices  = availableStatIncreases(character)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
    >
      <div className="max-w-lg w-full rounded border border-terminal-green/50 bg-terminal-bg p-6 font-mono">
        <div className="text-xs text-terminal-green/60 tracking-widest uppercase mb-1">
          Level Up
        </div>
        <div className="text-xl font-bold text-terminal-green mb-0.5">
          {character.name}
        </div>
        <div className="text-sm text-terminal-dim mb-5">
          {character.class} · LVL {event.oldLevel} → LVL {event.newLevel}
        </div>

        <div className="text-xs text-terminal-dim tracking-widest uppercase mb-3">
          Choose one upgrade
        </div>

        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1 mb-5">
          {skillChoices.length === 0 && traitChoices.length === 0 && statChoices.length === 0 && (
            <p className="text-sm text-terminal-dim italic">No upgrades available.</p>
          )}

          {/* Stat increases */}
          {statChoices.length > 0 && (
            <div className="mb-1">
              <div className="text-[9px] text-terminal-dim/50 tracking-widest uppercase mb-1 px-1">Stat Increase</div>
              {statChoices.map((choice, i) => {
                const isSelected = selected === choice
                return (
                  <button
                    key={`stat-${i}`}
                    onClick={() => setSelected(choice)}
                    className={`w-full text-left px-3 py-2 rounded border transition-all flex items-center gap-3 mb-1 ${
                      isSelected
                        ? 'border-terminal-green bg-terminal-green/10 text-white'
                        : 'border-terminal-border bg-terminal-surface text-gray-300 hover:border-terminal-dim hover:text-white'
                    }`}
                  >
                    <span className="text-[9px] font-semibold tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 text-terminal-green border-terminal-green/40 bg-terminal-green/10">
                      STAT
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{STAT_LABEL[choice.stat]} {choice.fromVal} → {choice.toVal}</div>
                    </div>
                    {isSelected && <span className="ml-auto text-terminal-green text-sm flex-shrink-0">✓</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* Skill upgrades */}
          {skillChoices.length > 0 && (
            <div className="mb-1">
              <div className="text-[9px] text-terminal-dim/50 tracking-widest uppercase mb-1 px-1">Skill Upgrade</div>
              {skillChoices.map((choice, i) => {
                const isSelected = selected === choice
                return (
                  <button
                    key={`skill-${i}`}
                    onClick={() => setSelected(choice)}
                    className={`w-full text-left px-3 py-2 rounded border transition-all flex items-center gap-3 mb-1 ${
                      isSelected
                        ? 'border-terminal-green bg-terminal-green/10 text-white'
                        : 'border-terminal-border bg-terminal-surface text-gray-300 hover:border-terminal-dim hover:text-white'
                    }`}
                  >
                    <span className="text-[9px] font-semibold tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 text-terminal-blue border-terminal-blue/40 bg-terminal-blue/10">
                      SKILL
                    </span>
                    <span className="text-sm flex-1">{choice.skillName} — Lvl {choice.fromLevel} → {choice.toLevel}</span>
                    {isSelected && <span className="ml-auto text-terminal-green text-sm flex-shrink-0">✓</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* New traits */}
          {traitChoices.length > 0 && (
            <div>
              <div className="text-[9px] text-terminal-dim/50 tracking-widest uppercase mb-1 px-1">New Trait</div>
              {traitChoices.map((choice, i) => {
                const isSelected = selected === choice
                const def = TRAIT_DEFINITIONS[choice.traitName]
                return (
                  <button
                    key={`trait-${i}`}
                    onClick={() => setSelected(choice)}
                    className={`w-full text-left px-3 py-2 rounded border transition-all flex items-start gap-3 mb-1 ${
                      isSelected
                        ? 'border-terminal-green bg-terminal-green/10 text-white'
                        : 'border-terminal-border bg-terminal-surface text-gray-300 hover:border-terminal-dim hover:text-white'
                    }`}
                  >
                    <span className="text-[9px] font-semibold tracking-widest px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 text-terminal-amber border-terminal-amber/40 bg-terminal-amber/10">
                      TRAIT
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{choice.traitName}</div>
                      {def && (
                        <>
                          <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">{def.description}</div>
                          <div className="text-[10px] text-terminal-blue/70 mt-0.5 leading-snug font-mono">{def.mechanicalEffect}</div>
                        </>
                      )}
                    </div>
                    {isSelected && <span className="text-terminal-green text-sm flex-shrink-0">✓</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
          className="w-full py-2.5 rounded border border-terminal-green/50 bg-terminal-green/10
            text-terminal-green text-sm font-semibold tracking-widest uppercase
            hover:bg-terminal-green/20 hover:border-terminal-green
            disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Confirm Upgrade
        </button>
      </div>
    </motion.div>
  )
}
