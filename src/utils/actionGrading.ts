import type { FeedEntry, OutcomeTier } from '../types/game'

// ─── Action triple extraction ─────────────────────────────────────────────────

export interface ActionTriple {
  index:     number
  action:    FeedEntry
  roll:      FeedEntry | null
  narration: FeedEntry | null
}

export function extractActionTriples(feed: FeedEntry[]): ActionTriple[] {
  const triples: ActionTriple[] = []
  let actionIndex = 0

  for (let i = 0; i < feed.length; i++) {
    if (feed[i].type !== 'player_action') continue

    // Find next roll_result within a short lookahead window
    let rollIdx = -1
    for (let j = i + 1; j < Math.min(i + 6, feed.length); j++) {
      if (feed[j].type === 'roll_result') { rollIdx = j; break }
    }

    // Find next dm_narration after the roll (or after the action if no roll found)
    let narIdx = -1
    const searchFrom = rollIdx >= 0 ? rollIdx + 1 : i + 1
    for (let j = searchFrom; j < Math.min(searchFrom + 6, feed.length); j++) {
      if (feed[j].type === 'dm_narration') { narIdx = j; break }
    }

    triples.push({
      index:     actionIndex++,
      action:    feed[i],
      roll:      rollIdx >= 0 ? feed[rollIdx] : null,
      narration: narIdx  >= 0 ? feed[narIdx]  : null,
    })
  }

  return triples
}

// ─── Mechanical grading ───────────────────────────────────────────────────────

export interface MechanicalGrade {
  letter:    string
  gpa:       number
  bgColor:   string
  textColor: string
  label:     string
}

const GRADE_MAP: Record<OutcomeTier, MechanicalGrade> = {
  critical_hit:  { letter: 'A+', gpa: 4.3, bgColor: 'bg-green-100',  textColor: 'text-green-800',  label: 'Critical Hit'  },
  success:       { letter: 'B',  gpa: 3.0, bgColor: 'bg-blue-100',   textColor: 'text-blue-800',   label: 'Success'       },
  partial:       { letter: 'C',  gpa: 2.0, bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', label: 'Partial'       },
  failure:       { letter: 'D',  gpa: 1.0, bgColor: 'bg-orange-100', textColor: 'text-orange-800', label: 'Failure'       },
  critical_fail: { letter: 'F',  gpa: 0.0, bgColor: 'bg-red-100',    textColor: 'text-red-800',    label: 'Critical Fail' },
}

export function mechanicalGrade(outcome: OutcomeTier): MechanicalGrade {
  return GRADE_MAP[outcome]
}

// ─── Per-player aggregate ─────────────────────────────────────────────────────

function gpaToLetter(gpa: number): string {
  if (gpa >= 4.15) return 'A+'
  if (gpa >= 3.85) return 'A'
  if (gpa >= 3.5)  return 'A−'
  if (gpa >= 3.15) return 'B+'
  if (gpa >= 2.85) return 'B'
  if (gpa >= 2.5)  return 'B−'
  if (gpa >= 2.15) return 'C+'
  if (gpa >= 1.85) return 'C'
  if (gpa >= 1.5)  return 'C−'
  if (gpa >= 1.15) return 'D+'
  if (gpa >= 0.85) return 'D'
  return 'F'
}

export interface PlayerGradeSummary {
  playerName:    string
  actionCount:   number
  averageGpa:    number
  overallLetter: string
  grades:        MechanicalGrade[]
}

export function computePlayerGrades(
  triples:     ActionTriple[],
  playerNames: string[],
): PlayerGradeSummary[] {
  return playerNames.map((name) => {
    const mine = triples.filter((t) => t.action.speaker === name && t.roll?.outcome)
    const grades = mine.map((t) => mechanicalGrade(t.roll!.outcome as OutcomeTier))
    const avg = grades.length > 0
      ? grades.reduce((sum, g) => sum + g.gpa, 0) / grades.length
      : 0
    return {
      playerName:    name,
      actionCount:   mine.length,
      averageGpa:    avg,
      overallLetter: grades.length > 0 ? gpaToLetter(avg) : '—',
      grades,
    }
  })
}
