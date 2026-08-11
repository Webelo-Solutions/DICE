import PDFDocument from 'pdfkit'
import type { SessionRecord } from '../../src/types/history'
import { extractActionTriples, computePlayerGrades } from '../../src/utils/actionGrading'
import { formatDuration, formatTimestamp } from '../../src/utils/learningPath'

const ACCENT   = '#0B5FFF'
const INK      = '#111111'
const DIM      = '#666666'
const OUTCOME_COLOR: Record<SessionRecord['outcome'], string> = {
  victory: '#1a7f37', partial: '#9a6700', defeat: '#cf222e',
}
const OUTCOME_LABEL: Record<SessionRecord['outcome'], string> = {
  victory: 'CONTAINED — Full Containment Achieved',
  partial: 'PARTIAL — Incomplete Containment',
  defeat:  'BREACH — Containment Failed',
}

// Renders a session's after-action report to a PDF buffer. Pure function of
// the stored SessionRecord (+ who it belongs to) — no DB/network access here,
// so it's safe to call from any route that has already authorized the read.
export function renderSessionReportPdf(record: SessionRecord, ownerLabel: string): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 56, bottom: 56, left: 60, right: 60 } })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)))
    doc.on('error', reject)

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right

    const ensure = (h: number) => {
      if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage()
    }
    const heading = (text: string) => {
      ensure(30)
      doc.font('Helvetica-Bold').fontSize(13).fillColor(ACCENT).text(text)
      doc.moveDown(0.4)
    }
    const kv = (label: string, value: string) => {
      ensure(16)
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DIM).text(label, { continued: true, width: contentWidth })
      doc.font('Helvetica').fontSize(9.5).fillColor(INK).text('  ' + value)
    }

    // ── Title ──────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(20).fillColor(ACCENT).text('DICE — After-Action Report', { align: 'center' })
    doc.moveDown(0.2)
    doc.font('Helvetica').fontSize(12).fillColor(INK).text(record.scenarioTitle, { align: 'center' })
    doc.moveDown(0.1)
    doc.font('Helvetica').fontSize(9).fillColor(DIM).text(record.scenarioId, { align: 'center' })
    doc.moveDown(1)

    // ── Outcome banner ─────────────────────────────────────────────────────
    const bannerH = 26
    ensure(bannerH + 12)
    doc.rect(doc.page.margins.left, doc.y, contentWidth, bannerH).fill(OUTCOME_COLOR[record.outcome])
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11)
      .text(OUTCOME_LABEL[record.outcome], doc.page.margins.left, doc.y + 8, { align: 'center', width: contentWidth })
    doc.y += bannerH - 8
    doc.moveDown(1)

    // ── Exercise details ───────────────────────────────────────────────────
    heading('Exercise Details')
    kv('Facilitator/Owner:', ownerLabel)
    kv('Difficulty:', '●'.repeat(record.difficulty) + '○'.repeat(5 - record.difficulty))
    kv('Players:', record.players.map((p) => `${p.name} (${p.class})`).join(', '))
    kv('Played:', formatTimestamp(record.playedAt))
    kv('Duration:', formatDuration(record.result.startedAt, record.result.endedAt))
    kv('Rounds Played:', String(record.result.roundsPlayed))
    kv('Acts Completed:', String(record.result.actsCompleted))
    kv('Final Attacker Stage:', record.result.finalAttackerStage)
    doc.moveDown(0.8)

    // ── Metrics ────────────────────────────────────────────────────────────
    heading('Metrics')
    kv('XP Awarded:', String(record.result.xpAwarded))
    kv('Critical Hits / Fails:', `${record.result.criticalHits} / ${record.result.criticalFails}`)
    kv('Injects Survived:', String(record.result.injectsSurvived))
    kv('Critical Injects Fired:', String(record.result.criticalInjectsFired))
    kv('Scenario Clock Remaining:', `${record.result.clockRemaining} min`)
    kv('Hints Used:', String(record.result.hintsUsed))
    kv('Round Timer Expiries:', String(record.result.timerExpiries))
    doc.moveDown(0.8)

    // ── Per-player grades (derived from the transcript, if present) ────────
    if (record.feed && record.feed.length > 0) {
      const triples = extractActionTriples(record.feed)
      const grades  = computePlayerGrades(triples, record.players.map((p) => p.name))
      if (grades.some((g) => g.actionCount > 0)) {
        heading('Player Performance')
        for (const g of grades) {
          if (g.actionCount === 0) continue
          kv(`${g.playerName}:`, `${g.overallLetter} (${g.actionCount} action${g.actionCount !== 1 ? 's' : ''}, GPA ${g.averageGpa.toFixed(2)})`)
        }
        doc.moveDown(0.8)
      }
    }

    // ── Learning path ──────────────────────────────────────────────────────
    if (record.learningPath.length > 0) {
      heading('Learning Path')
      for (const item of record.learningPath) {
        ensure(50)
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text(`${item.area}  `, { continued: true })
        doc.font('Helvetica').fontSize(8.5).fillColor(DIM).text(`[${item.priority.toUpperCase()}]`)
        doc.font('Helvetica').fontSize(9).fillColor(INK).text(item.recommendation, { width: contentWidth })
        doc.font('Helvetica-Oblique').fontSize(8).fillColor(DIM).text(item.nistRef)
        doc.moveDown(0.5)
      }
      doc.moveDown(0.3)
    }

    // ── Timeline (full transcript) ─────────────────────────────────────────
    if (record.feed && record.feed.length > 0) {
      heading('Session Timeline — Audit Log')
      for (const entry of record.feed) {
        ensure(28)
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(ACCENT)
          .text(`${entry.speaker}`, { continued: true })
        doc.font('Helvetica').fontSize(7.5).fillColor(DIM)
          .text(`  ${formatTimestamp(entry.timestamp)}${entry.outcome ? `  ·  ${entry.outcome}` : ''}`)
        doc.font('Helvetica').fontSize(9).fillColor(INK).text(entry.text, { width: contentWidth })
        doc.moveDown(0.4)
      }
    }

    doc.moveDown(1)
    ensure(20)
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(DIM)
      .text(`Generated by DICE on ${formatTimestamp(Date.now())}. This report reflects data recorded at session end.`, { align: 'center' })

    doc.end()
  })
}
