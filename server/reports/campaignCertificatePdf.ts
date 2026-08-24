import PDFDocument from 'pdfkit'
import { ACCENT, INK, DIM, RULE, paintCertificateBackground, drawSignatureBlock } from './certificateChrome'

// What the certificate needs to know about a finished campaign. Deliberately
// the same shape src/utils/campaignCertificate.ts already computes client-side
// for the PNG "audit" certificate — this route renders that same, already-
// trusted data, it doesn't re-derive it. Campaigns have no server-side record
// of their own (see server/db/schema.ts), so there's nothing to look up by id;
// the client sends what it already built.
export interface CampaignCertificateInput {
  recipientName:  string
  campaignName:   string
  startedAt:      number
  completedAt:    number
  scenarioCount:  number
  totalHours:     number
  outcomeCounts:  { victory: number; partial: number; defeat: number }
  certificateId:  string
}

const OUTCOME_LABEL: Record<keyof CampaignCertificateInput['outcomeCounts'], string> = {
  victory: 'contained', partial: 'partial', defeat: 'breach',
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Renders a campaign's completion certificate — a lighter, executive-summary
// companion to the detailed PNG certificate (src/utils/certificateImage.ts),
// which stays the record of what happened scenario by scenario. This one
// answers a different question: "who finished it, and when."
export function renderCampaignCertificatePdf(cert: CampaignCertificateInput): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margins: { top: 42, bottom: 42, left: 64, right: 64 } })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolvePromise(Buffer.concat(chunks)))
    doc.on('error', reject)

    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right

    paintCertificateBackground(doc, width)

    // ── Header ───────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(10).fillColor(DIM)
      .text('CERTIFICATE OF COMPLETION', { align: 'center', characterSpacing: 2 })
    doc.moveDown(0.3)
    doc.font('Helvetica-Bold').fontSize(24).fillColor(ACCENT)
      .text('Incident Response Campaign', { align: 'center' })
    doc.moveDown(0.2)
    doc.font('Helvetica').fontSize(11).fillColor(DIM)
      .text('Awarded for completing every scenario in the sequence', { align: 'center' })

    doc.moveDown(1.2)
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + width, doc.y)
      .strokeColor(RULE).lineWidth(1).stroke()
    doc.moveDown(1.2)

    // ── Recipient ────────────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(11).fillColor(DIM).text('This certifies that', { align: 'center' })
    doc.moveDown(0.4)
    doc.font('Helvetica-Bold').fontSize(22).fillColor(INK).text(cert.recipientName, { align: 'center' })
    doc.moveDown(0.5)
    doc.font('Helvetica').fontSize(11).fillColor(DIM)
      .text('has completed, in its entirety, the incident response campaign', { align: 'center' })
    doc.moveDown(0.5)

    doc.font('Helvetica-Bold').fontSize(26).fillColor(ACCENT).text(cert.campaignName, { align: 'center' })

    doc.moveDown(1.4)

    // ── Campaign detail ──────────────────────────────────────────────────────
    const labelWidth = 150
    const row = (label: string, value: string) => {
      const y = doc.y
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DIM)
        .text(label.toUpperCase(), doc.page.margins.left, y, { width: labelWidth, characterSpacing: 0.5 })
      doc.font('Helvetica').fontSize(10).fillColor(INK)
        .text(value, doc.page.margins.left + labelWidth, y, { width: width - labelWidth })
      doc.moveDown(0.55)
    }

    const { victory, partial, defeat } = cert.outcomeCounts
    row('Scenarios completed', String(cert.scenarioCount))
    row('Result record', `${victory} ${OUTCOME_LABEL.victory} · ${partial} ${OUTCOME_LABEL.partial} · ${defeat} ${OUTCOME_LABEL.defeat}`)
    row('Date started', formatDate(cert.startedAt))
    row('Date completed', formatDate(cert.completedAt))
    row('Total gameplay', `${cert.totalHours} hour${cert.totalHours === 1 ? '' : 's'}`)

    doc.moveDown(0.8)
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + width, doc.y)
      .strokeColor(RULE).lineWidth(1).stroke()
    doc.moveDown(0.8)

    // ── How the figures were reached ────────────────────────────────────────
    // Every call below pins x explicitly — see cpeCertificatePdf.ts for why
    // that matters after the row() column layout above leaves pdfkit's text
    // cursor sitting at a non-margin x.
    doc.font('Helvetica-Bold').fontSize(9).fillColor(DIM)
      .text('BASIS OF RECORD', doc.page.margins.left, doc.y, { characterSpacing: 0.5 })
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(9).fillColor(INK).text(
      'Gameplay hours are measured from each scenario’s session start and end timestamps, not from '
      + 'scheduled length, and rounded down to whole hours; the total is rounded down from the exact '
      + 'summed play time and may therefore exceed the sum of the figures per scenario. A detailed, '
      + 'scenario-by-scenario record accompanies this certificate.',
      doc.page.margins.left, doc.y, { width, align: 'left' },
    )

    doc.moveDown(0.4)

    // ── Signature ────────────────────────────────────────────────────────────
    drawSignatureBlock(doc, doc.page.margins.left)

    doc.font('Helvetica').fontSize(8).fillColor(DIM).text(
      `Verification reference: ${cert.certificateId} · issued ${formatDate(cert.completedAt)}`,
      doc.page.margins.left, doc.y, { width },
    )

    doc.end()
  })
}
