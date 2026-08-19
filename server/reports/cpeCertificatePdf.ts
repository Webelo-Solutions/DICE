import PDFDocument from 'pdfkit'
import type { SessionRecord } from '../../src/types/history'
import type { CpeAward } from '../../src/types/cpe'
import { formatTimestamp } from '../../src/utils/learningPath'

const ACCENT = '#0B5FFF'
const INK    = '#111111'
const DIM    = '#666666'
const RULE   = '#DDDDDD'

// Renders one attendee's CPE certificate for one session. Pure function of the
// stored record plus the award being certified — the credit number is NOT
// recalculated here. It is read from what was computed and stored at session
// end, so a certificate reprinted a year later says exactly what the original
// said, even if the rules in src/utils/cpe.ts have since been revised.
export function renderCpeCertificatePdf(
  record: SessionRecord,
  award: CpeAward,
  providerName: string,
): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margins: { top: 56, bottom: 56, left: 64, right: 64 } })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)))
    doc.on('error', reject)

    const cpe = record.cpe!
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right

    // ── Header ───────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(10).fillColor(DIM)
      .text('CERTIFICATE OF ATTENDANCE', { align: 'center', characterSpacing: 2 })
    doc.moveDown(0.3)
    doc.font('Helvetica-Bold').fontSize(24).fillColor(ACCENT)
      .text('Continuing Professional Education', { align: 'center' })
    doc.moveDown(0.2)
    doc.font('Helvetica').fontSize(11).fillColor(DIM)
      .text('Incident Response Tabletop Exercise', { align: 'center' })

    doc.moveDown(1.2)
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + width, doc.y)
      .strokeColor(RULE).lineWidth(1).stroke()
    doc.moveDown(1.2)

    // ── Attendee ─────────────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(11).fillColor(DIM).text('This certifies that', { align: 'center' })
    doc.moveDown(0.4)
    doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text(award.attendeeName, { align: 'center' })
    doc.moveDown(0.5)
    doc.font('Helvetica').fontSize(11).fillColor(DIM)
      .text('attended the following activity and earned', { align: 'center' })
    doc.moveDown(0.5)

    doc.font('Helvetica-Bold').fontSize(30).fillColor(ACCENT)
      .text(`${award.credits.toFixed(1)} CPE`, { align: 'center' })
    doc.font('Helvetica').fontSize(10).fillColor(DIM)
      .text(`ISC² Group ${award.group} — domain-related`, { align: 'center' })

    doc.moveDown(1.4)

    // ── Activity detail ──────────────────────────────────────────────────────
    const labelWidth = 150
    const row = (label: string, value: string) => {
      const y = doc.y
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DIM)
        .text(label.toUpperCase(), doc.page.margins.left, y, { width: labelWidth, characterSpacing: 0.5 })
      doc.font('Helvetica').fontSize(10).fillColor(INK)
        .text(value, doc.page.margins.left + labelWidth, y, { width: width - labelWidth })
      doc.moveDown(0.55)
    }

    row('Activity', cpe.activityTitle)
    row('Date completed', formatTimestamp(cpe.activityDate))
    row('Delivery method', 'Group live — facilitated tabletop exercise')
    row('Provider', providerName)
    // The distinction that makes this defensible: contact time is what this
    // person was connected for, which is not necessarily the session's length.
    row('Contact time', `${award.attendedMinutes} minutes attended, of a ${cpe.sessionMinutes}-minute session`)
    if (award.gameRole) row('Role staffed', award.gameRole + (award.departmentName ? ` — ${award.departmentName}` : ''))

    doc.moveDown(0.8)
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + width, doc.y)
      .strokeColor(RULE).lineWidth(1).stroke()
    doc.moveDown(0.8)

    // ── How the number was reached ───────────────────────────────────────────
    // Printed on the certificate rather than kept in a database, because the
    // reader who has to accept this number is the one holding the paper.
    doc.font('Helvetica-Bold').fontSize(9).fillColor(DIM).text('BASIS OF AWARD', { characterSpacing: 0.5 })
    doc.moveDown(0.3)
    const fragments = award.spans > 1
      ? ` Attendance was recorded across ${award.spans} separate connections${award.disconnects > 0 ? ` (${award.disconnects} disconnect${award.disconnects === 1 ? '' : 's'})` : ''}.`
      : ''
    doc.font('Helvetica').fontSize(9).fillColor(INK).text(
      `Credit is awarded at one CPE per ${cpe.rules.minutesPerCredit} minutes of measured attendance, in `
      + `${cpe.rules.creditIncrement} credit increments, rounded down. Attendance is measured from connection `
      + `records captured during the exercise, not from the scheduled length.${fragments}`,
      { width, align: 'left' },
    )

    doc.moveDown(0.9)
    doc.font('Helvetica').fontSize(8).fillColor(DIM).text(
      `Verification reference: session ${record.id} · participant ${award.participantId}`,
      { width },
    )
    doc.moveDown(0.2)
    doc.font('Helvetica').fontSize(8).fillColor(DIM).text(
      'The attendee is responsible for confirming this activity qualifies under the CPE policy of the '
      + 'credential being maintained, and for submitting it to ISC². This certificate records attendance; '
      + 'it is not an ISC²-endorsed document.',
      { width },
    )

    doc.end()
  })
}
