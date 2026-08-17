import type { SessionRecord } from '../types/history'
import type { ScenarioPack } from '../types/game'
import { ALL_SCENARIOS } from '../data/scenarios'

export interface TechniqueInfo {
  id:   string
  name: string
}

export interface TechniqueCoverage extends TechniqueInfo {
  scenarioTitles: string[]   // scenarios in the library that cover this technique
}

// Every unique MITRE technique referenced anywhere in the built-in scenario
// library, each with which scenarios cover it — so a gap can point straight
// at a scenario that would close it, not just name the gap.
export function techniqueUniverse(): TechniqueCoverage[] {
  const map = new Map<string, TechniqueCoverage>()
  for (const scenario of ALL_SCENARIOS) {
    for (const act of scenario.acts) {
      for (const clue of act.clues) {
        if (!clue.techniqueId) continue
        const existing = map.get(clue.techniqueId)
        if (existing) {
          if (!existing.scenarioTitles.includes(scenario.title)) existing.scenarioTitles.push(scenario.title)
        } else {
          map.set(clue.techniqueId, {
            id:             clue.techniqueId,
            name:           clue.techniqueName ?? clue.techniqueId,
            scenarioTitles: [scenario.title],
          })
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id))
}

// Techniques actually encountered across a set of session-history records.
// Technique data isn't persisted on SessionRecord itself (only scenarioId
// is), so this resolves each played scenario against the current library —
// the source of truth for what a scenario covers.
export function encounteredTechniques(history: SessionRecord[]): Set<string> {
  const seen = new Set<string>()
  const scenarioIds = new Set(history.map((r) => r.scenarioId))
  for (const scenario of ALL_SCENARIOS) {
    if (!scenarioIds.has(scenario.id)) continue
    for (const act of scenario.acts) {
      for (const clue of act.clues) {
        if (clue.techniqueId) seen.add(clue.techniqueId)
      }
    }
  }
  return seen
}

export interface TechniqueGapResult {
  total:   number
  covered: number
  gaps:    TechniqueCoverage[]   // never encountered
}

// Diffs the full technique universe against what's been played so far —
// "true gap" semantics (never encountered), not just "what was covered".
export function techniqueCoverageGaps(history: SessionRecord[]): TechniqueGapResult {
  const universe    = techniqueUniverse()
  const encountered = encounteredTechniques(history)
  const gaps = universe.filter((t) => !encountered.has(t.id))
  return { total: universe.length, covered: universe.length - gaps.length, gaps }
}

// Every distinct MITRE technique a single scenario's clues reference — used
// to search/filter the scenario library by technique (works for both built-in
// and custom scenarios, unlike techniqueUniverse() which only walks ALL_SCENARIOS).
export function scenarioTechniques(scenario: ScenarioPack): TechniqueInfo[] {
  const map = new Map<string, TechniqueInfo>()
  for (const act of scenario.acts) {
    for (const clue of act.clues) {
      if (!clue.techniqueId) continue
      if (!map.has(clue.techniqueId)) {
        map.set(clue.techniqueId, { id: clue.techniqueId, name: clue.techniqueName ?? clue.techniqueId })
      }
    }
  }
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id))
}

// Case-insensitive match against a technique's id or name — a query like
// "t1566" or "phishing" both match technique T1566 "Phishing".
export function matchingTechniques(scenario: ScenarioPack, query: string): TechniqueInfo[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return scenarioTechniques(scenario).filter(
    (t) => t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
  )
}

// For a scenario's own technique list (Hot Wash already has this from the
// live session), determines which are new to this player based on PRIOR
// history — excludes the current session id so a just-recorded session
// doesn't retroactively mark its own techniques as "already seen".
export function noveltyForScenario(
  techniques:        TechniqueInfo[],
  priorHistory:      SessionRecord[],
  currentSessionId:  string,
): Set<string> {
  const priorEncountered = encounteredTechniques(priorHistory.filter((r) => r.id !== currentSessionId))
  const novel = new Set<string>()
  for (const t of techniques) {
    if (!priorEncountered.has(t.id)) novel.add(t.id)
  }
  return novel
}
