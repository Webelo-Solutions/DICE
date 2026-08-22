// Verifies the campaign completion certificate without a browser.
//
// The certificate's height is computed by layoutHeight() before a single stroke
// is drawn, so the failure mode that matters is layout drift: add a row to the
// drawing pass and forget the measuring pass, and the last footnote silently
// falls off the bottom of the PNG. Nobody notices until a user downloads one.
//
// This stubs a recording 2D context, runs the real renderer, and asserts that
// everything it drew landed inside the frame — plus the arithmetic rules the
// certificate makes claims about.
//
//   npm run verify:certificate

import { buildCampaignCertificate, isCampaignCertifiable } from '../src/utils/campaignCertificate'
import { renderCampaignCertificate } from '../src/utils/certificateImage'
import { ALL_SCENARIOS } from '../src/data/scenarios'
import type { Campaign } from '../src/types/campaign'
import type { Character } from '../src/types/game'
import type { SessionRecord } from '../src/types/history'

const HOUR = 3_600_000
const DAY  = 86_400_000

let failures = 0
function check(label: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// ── Recording canvas stub ────────────────────────────────────────────────────
// measureText approximates advance width from the font size in ctx.font. It
// only needs to be in the right ballpark: the assertions below are about
// whether the layout leaves room, not about pixel-exact glyph metrics.

interface DrawnText { text: string; x: number; y: number; align: string; width: number }

function makeContext(record: { texts: DrawnText[]; maxY: number }) {
  const ctx: any = {
    font: '10px sans-serif',
    fillStyle: '', strokeStyle: '', lineWidth: 1,
    textAlign: 'left', textBaseline: 'alphabetic', letterSpacing: '0px',
    measureText(text: string) {
      const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? '10')
      const extra = parseFloat(this.letterSpacing) || 0
      return { width: text.length * size * 0.52 + text.length * extra }
    },
    fillText(text: string, x: number, y: number) {
      record.texts.push({ text, x, y, align: this.textAlign, width: this.measureText(text).width })
      record.maxY = Math.max(record.maxY, y)
    },
    scale() {}, setTransform() {}, fillRect() {}, strokeRect() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo(_x: number, y: number) { record.maxY = Math.max(record.maxY, y) },
    arc() {}, stroke() {}, fill() {},
  }
  return ctx
}

function renderOffscreen(cert: ReturnType<typeof buildCampaignCertificate>) {
  const record = { texts: [] as DrawnText[], maxY: 0 }
  // The renderer asks for two canvases: the real one first, then a throwaway to
  // probe the height on. Only the first records, so the assertions below see
  // exactly the marks that end up in the PNG.
  const canvas: any = { width: 0, height: 0, getContext: () => makeContext(record) }
  let handed = 0
  const scratch = { texts: [] as DrawnText[], maxY: 0 }
  ;(globalThis as any).document = {
    createElement: () => (handed++ === 0 ? canvas : { width: 0, height: 0, getContext: () => makeContext(scratch) }),
  }

  // Safe to call with only the stub in place: the renderer touches `document`
  // inside the function, never at module scope.
  renderCampaignCertificate(cert as any)
  return { canvas, record }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const picks = ALL_SCENARIOS.slice(0, 4)

const roster: Character[] = [
  { id: 'c1', name: 'Ada Reyes',  class: 'Analyst' as any, stats: {} as any, skills: [], traits: [], level: 4, xp: 900 },
  { id: 'c2', name: 'Ben Okafor', class: 'Hunter'  as any, stats: {} as any, skills: [], traits: [], level: 3, xp: 620 },
]

const base = Date.parse('2026-03-04T14:00:00Z')

function sessionRecord(id: string, scenarioId: string, startedAt: number, spanMs: number): SessionRecord {
  const pack = ALL_SCENARIOS.find((s) => s.id === scenarioId)!
  return {
    id, scenarioId, scenarioTitle: pack.title, difficulty: pack.difficulty,
    outcome: 'victory', playerCount: 2,
    players: roster.map((c) => ({ id: c.id, name: c.name, class: c.class })),
    result: {
      outcome: 'victory', xpAwarded: 500, xpByPlayer: {}, criticalHits: 2, criticalFails: 1,
      injectsSurvived: 3, criticalInjectsFired: 1, clockRemaining: 10, roundsPlayed: 12,
      startedAt, endedAt: startedAt + spanMs, actsCompleted: 3, finalAttackerStage: 'contained',
      hintsUsed: 0, timerExpiries: 1,
    },
    learningPath: [], playedAt: startedAt + spanMs,
  }
}

// A campaign carrying its own timing (the path new completions take).
const timedCampaign: Campaign = {
  id: 'camp-timed-0001', name: 'Operation Blackout Arc',
  description: 'A single intrusion set escalating across four engagements, from first beacon to boardroom.',
  scenarioSequence: picks.map((s) => s.id),
  characterIds: ['c1', 'c2'], status: 'completed', currentScenarioIndex: 4,
  scenarioResults: picks.map((s, i) => ({
    scenarioIndex: i, scenarioId: s.id,
    outcome: (['victory', 'partial', 'victory', 'defeat'] as const)[i],
    completedAt: base + i * 30 * DAY + 4 * HOUR,
    sessionId: `sess-${i}`,
    startedAt:  base + i * 30 * DAY,
    // 1h50m, 3h10m, 2h30m, 4h05m — deliberately fractional so flooring shows
    endedAt:    base + i * 30 * DAY + [110, 190, 150, 245][i] * 60_000,
  })),
  notes: '', createdAt: base - 20 * DAY, updatedAt: base + 90 * DAY,
}

// The same campaign as written before timing fields existed — durations must be
// recovered from session history instead.
const legacyCampaign: Campaign = {
  ...timedCampaign,
  id: 'camp-legacy-002', name: 'Legacy Arc',
  scenarioResults: timedCampaign.scenarioResults.map(({ sessionId, startedAt, endedAt, ...rest }) => rest),
}

const history: SessionRecord[] = picks.map((s, i) =>
  sessionRecord(`sess-${i}`, s.id, base + i * 30 * DAY, [110, 190, 150, 245][i] * 60_000))

// ── Checks ───────────────────────────────────────────────────────────────────

console.log('\nCampaign completion certificate\n')

console.log('Certifiability')
check('completed + fully resulted campaign qualifies', isCampaignCertifiable(timedCampaign))
check('campaign still active does not qualify',
  !isCampaignCertifiable({ ...timedCampaign, status: 'active' }))
check('status flipped to completed by hand, with no results, does not qualify',
  !isCampaignCertifiable({ ...timedCampaign, scenarioResults: [] }))
check('builder returns null when a scenario has no result',
  buildCampaignCertificate(
    { ...timedCampaign, scenarioResults: timedCampaign.scenarioResults.slice(0, 3) },
    'Ada Reyes', [], history, roster,
  ) === null)

console.log('\nHours')
const cert = buildCampaignCertificate(timedCampaign, 'KC Yerrid', [], history, roster)!
const hours = cert.scenarios.map((s) => s.hours)
check('per-scenario hours are floored', JSON.stringify(hours) === JSON.stringify([1, 3, 2, 4]),
  `got ${JSON.stringify(hours)}`)
check('every per-scenario figure is a whole integer', hours.every(Number.isInteger))
const exactHours = (110 + 190 + 150 + 245) / 60
check('total floors the exact sum, not the sum of floors',
  cert.totalHours === Math.floor(exactHours) && cert.totalHours === 11,
  `total ${cert.totalHours}, sum of floors ${hours.reduce((a, b) => a + b, 0)}`)
check('start date is first recorded play, not campaign creation',
  cert.startedAt === base && cert.startedAt !== timedCampaign.createdAt)
check('completion date is the last scenario finished',
  cert.completedAt === Math.max(...timedCampaign.scenarioResults.map((r) => r.completedAt)))

console.log('\nLegacy backfill')
const legacy = buildCampaignCertificate(legacyCampaign, 'KC Yerrid', [], history, roster)!
check('hours recovered from session history',
  JSON.stringify(legacy.scenarios.map((s) => s.hours)) === JSON.stringify([1, 3, 2, 4]),
  `got ${JSON.stringify(legacy.scenarios.map((s) => s.hours))}`)
check('falls back to createdAt when nothing recorded a start',
  legacy.startedAt === legacyCampaign.createdAt)
const noHistory = buildCampaignCertificate(legacyCampaign, 'KC Yerrid', [], [], roster)!
check('scenarios with no resolvable timing are flagged untimed, not zero-hour',
  noHistory.untimedCount === 4 && noHistory.scenarios.every((s) => !s.timed))

console.log('\nImplausible spans')
const overnight = buildCampaignCertificate(
  {
    ...timedCampaign,
    scenarioResults: timedCampaign.scenarioResults.map((r, i) =>
      i === 0 ? { ...r, endedAt: r.startedAt! + 3 * DAY } : r),
  },
  'KC Yerrid', [], [], roster,
)!
check('a tab left open for days does not inflate the total',
  overnight.scenarios[0].timed === false && overnight.totalHours === 9,
  `total ${overnight.totalHours}`)

console.log('\nOther campaign detail')
check('outcome record counted', JSON.stringify(cert.outcomeCounts) === JSON.stringify({ victory: 2, partial: 1, defeat: 1 }))
check('XP summed from the campaign\'s own sessions', cert.totalXp === 2000, `got ${cert.totalXp}`)
check('roster resolved to named characters', cert.characters.length === 2 && cert.characters[0].name === 'Ada Reyes')
check('difficulty carried with a label for every scenario',
  cert.scenarios.every((s) => s.difficulty >= 1 && s.difficulty <= 5 && s.difficultyLabel.length > 0))
const again = buildCampaignCertificate(timedCampaign, 'KC Yerrid', [], history, roster)!
check('certificate reference is stable across reprints', cert.certificateId === again.certificateId)

console.log('\nLayout')
const { canvas, record } = renderOffscreen(cert)
const SCALE = 2, MARGIN = 54
const logicalH = canvas.height / SCALE
const logicalW = canvas.width / SCALE
check('canvas sized from the layout constants', logicalW === 1100 && canvas.height > 0,
  `${canvas.width}x${canvas.height}`)
check('everything drawn stays above the bottom frame',
  record.maxY <= logicalH - MARGIN / 2 - 8,
  `lowest draw at y=${record.maxY.toFixed(0)}, frame ends at ${(logicalH - MARGIN / 2 - 8).toFixed(0)}`)
check('bottom margin is neither negative nor wasteful',
  logicalH - record.maxY >= 0 && logicalH - record.maxY < 120,
  `${(logicalH - record.maxY).toFixed(0)}pt of slack`)

const rightEdge = logicalW - MARGIN / 2 - 8
const overflow = record.texts.filter((t) => {
  const startX = t.align === 'right' ? t.x - t.width : t.align === 'center' ? t.x - t.width / 2 : t.x
  return startX < MARGIN / 2 + 8 || startX + t.width > rightEdge
})
check('no drawn text escapes the frame horizontally', overflow.length === 0,
  overflow.slice(0, 3).map((t) => `"${t.text.slice(0, 40)}"`).join(', '))

check('the recipient name is on the certificate', record.texts.some((t) => t.text === 'KC Yerrid'))
check('the campaign title is on the certificate', record.texts.some((t) => t.text.startsWith('Operation Blackout')))
check('every scenario title appears',
  cert.scenarios.every((s) => record.texts.some((t) => t.text.replace('…', '') && s.title.startsWith(t.text.replace('…', '')))))

// A long campaign has to grow the canvas rather than overprint its footnotes.
console.log('\nLayout under load (12 scenarios, long titles)')
const longSeq = Array.from({ length: 12 }, (_, i) => picks[i % picks.length].id)
const bigCampaign: Campaign = {
  ...timedCampaign,
  name: 'Operation Blackout Arc: The Extended Multi-Quarter Purple Team Engagement Series',
  description: 'A deliberately long premise used to prove the description block wraps and clamps '
    + 'rather than running past the frame, however much narrative the facilitator types into it, '
    + 'and it keeps going well past any reasonable length to force the clamp.',
  scenarioSequence: longSeq,
  // First six carry timing, the rest do not: one render then exercises both the
  // hours column and the "not recorded" fallback, and earns the untimed note.
  scenarioResults: longSeq.map((id, i) => ({
    scenarioIndex: i, scenarioId: id, outcome: 'victory' as const,
    completedAt: base + i * DAY + 4 * HOUR,
    ...(i < 6
      ? { sessionId: `big-${i}`, startedAt: base + i * DAY, endedAt: base + i * DAY + 137 * 60_000 }
      : {}),
  })),
}
const bigCert = buildCampaignCertificate(bigCampaign, 'Wilhelmina Fitzgerald-Castellanos', [], [], roster)!
const big = renderOffscreen(bigCert)
check('canvas grows with the scenario count',
  big.canvas.height > canvas.height, `${big.canvas.height} vs ${canvas.height}`)
check('12-row certificate still fits its frame',
  big.record.maxY <= big.canvas.height / SCALE - MARGIN / 2 - 8,
  `lowest draw y=${big.record.maxY.toFixed(0)}, frame ends ${(big.canvas.height / SCALE - MARGIN / 2 - 8).toFixed(0)}`)
const bigOverflow = big.record.texts.filter((t) => {
  const startX = t.align === 'right' ? t.x - t.width : t.align === 'center' ? t.x - t.width / 2 : t.x
  return startX < MARGIN / 2 + 8 || startX + t.width > rightEdge
})
check('both timed and untimed rows render in one table',
  big.record.texts.some((t) => t.text === 'not recorded')
  && bigCert.scenarios.filter((sc) => sc.timed).length === 6)
check('long titles are ellipsised, not overprinted', bigOverflow.length === 0,
  bigOverflow.slice(0, 3).map((t) => `"${t.text.slice(0, 40)}"`).join(', '))
// Joined, because the footnote is drawn as wrapped lines and the phrase can
// straddle a line break.
check('untimed footnote appears when hours are missing',
  big.record.texts.map((t) => t.text).join(' ').includes('completed before play time was recorded'))

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}\n`)
process.exit(failures === 0 ? 0 : 1)
