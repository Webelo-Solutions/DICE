import type { CampaignCertificate } from './campaignCertificate'

// Renders a campaign completion certificate to a PNG.
//
// Client-side canvas rather than a server route on purpose: the certificate is
// built entirely from state the browser already holds, it works with the server
// unreachable, and pdfkit — which renders the CPE certificate in
// server/reports/cpeCertificatePdf.ts — cannot emit a raster image. Everything
// below is laid out in logical points and scaled up at draw time, so the export
// resolution is one constant rather than a second set of numbers.

const SCALE  = 2                      // 2200 x N px output from a 1100pt layout
const W      = 1100
const MARGIN = 54

const INK   = '#16233D'   // deep navy — headings and body
const GOLD  = '#A8873F'   // rule accents and the crest
const DIM   = '#6B7280'   // labels and footnotes
const PAPER = '#FDFCF7'
const RULE  = '#D9D3C4'
const HAIR  = '#EDE8DC'   // table row separators

const SERIF = 'Georgia, "Times New Roman", Times, serif'
const SANS  = '"Segoe UI", Helvetica, Arial, sans-serif'

const OUTCOME_LABEL: Record<string, string> = {
  victory: 'Contained',
  partial: 'Partial',
  defeat:  'Breach',
}

const ROW_H       = 30
const NOTE_LINE_H = 14

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

// Cuts a string to fit `max` points, appending an ellipsis. Certificates carry
// user-authored campaign and scenario titles of unbounded length; letting one
// overrun its column would paint over the neighbouring cell.
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let s = text
  while (s.length > 1 && ctx.measureText(s + '…').width > max) s = s.slice(0, -1)
  return s + '…'
}

// Wraps to at most `maxLines` lines, ellipsising the last. Returns the lines so
// the caller can advance its own cursor by however many came back.
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > max && line) {
      if (lines.length === maxLines - 1) {
        lines.push(fit(ctx, `${line} ${word}`, max))
        return lines
      }
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

// Difficulty rating, drawn as paths rather than typed as text. The geometric
// glyphs this used to use (U+25C6/U+25C7) are absent from several common font
// stacks and fall back to tofu boxes — which would silently erase the rating
// from a document people keep. Paths render identically everywhere.
function drawPips(ctx: CanvasRenderingContext2D, x: number, baseline: number, filled: number): void {
  const R = 4.5, GAP = 13, cy = baseline - 4
  ctx.fillStyle = GOLD
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 1
  for (let i = 0; i < 5; i++) {
    const cx = x + R + i * GAP
    ctx.beginPath()
    ctx.moveTo(cx, cy - R)
    ctx.lineTo(cx + R, cy)
    ctx.lineTo(cx, cy + R)
    ctx.lineTo(cx - R, cy)
    ctx.closePath()
    if (i < filled) ctx.fill()
    else ctx.stroke()
  }
}

// The footnotes a certificate carries, as sentences. Kept separate from the
// drawing pass because their wrapped line count feeds the height calculation.
function footnotes(cert: CampaignCertificate): string[] {
  return [
    'Per-scenario hours are rounded down to whole hours; the total is rounded down from the exact '
      + 'recorded playing time and may therefore exceed their sum.',
    cert.untimedCount > 0
      ? `${cert.untimedCount} scenario${cert.untimedCount === 1 ? ' was' : 's were'} completed before `
        + 'play time was recorded and contribute no hours to the total.'
      : '',
    `Reference ${cert.certificateId} · issued ${formatDate(cert.completedAt)}. Gameplay time is measured `
      + 'from session start and end timestamps captured during play, not from scheduled length.',
  ].filter(Boolean)
}

const contentW = W - MARGIN * 2
const innerW   = contentW - 44
const left     = MARGIN + 22
const centre   = W / 2

// Clearance between the last mark drawn and the bottom of the image, chosen so
// the footnotes sit clear of the inner frame rule at H - 35.
const BOTTOM_PAD = 32

// The strings whose wrapped length varies with the campaign, resolved once and
// reused by both paint passes so the two agree by construction.
interface Measured {
  descLines: string[]
  detail:    [string, string][]
  noteLines: string[]
}

function measureContent(ctx: CanvasRenderingContext2D, cert: CampaignCertificate): Measured {
  ctx.font = `italic 15px ${SERIF}`
  const descLines = cert.description.trim()
    ? wrap(ctx, cert.description.trim(), innerW - 80, 3)
    : []

  const { victory, partial, defeat } = cert.outcomeCounts
  const detail: [string, string][] = [
    ['Result Record',      `${victory} contained · ${partial} partial · ${defeat} breach`],
    ['Average Difficulty', `${cert.averageDifficulty.toFixed(1)} of 5`],
  ]
  if (cert.totalXp > 0) detail.push(['Experience Earned', `${cert.totalXp.toLocaleString()} XP`])
  if (cert.characters.length) {
    detail.push([
      cert.characters.length === 1 ? 'Character' : 'Response Team',
      cert.characters.map((c) => `${c.name} (${c.class}, Lv ${c.level})`).join(' · '),
    ])
  }

  ctx.font = `10px ${SANS}`
  const noteLines = footnotes(cert).flatMap((note) => wrap(ctx, note, contentW - 44, 2))

  return { descLines, detail, noteLines }
}

// Draws everything inside the frame and returns the y cursor left after the
// last mark. Run once against a provisionally-sized canvas to discover the
// height, then again for real — so the image is exactly as tall as the drawing
// code needs, and the two can never drift apart the way a hand-maintained table
// of section heights does.
function paintBody(ctx: CanvasRenderingContext2D, cert: CampaignCertificate, m: Measured): number {
  const { descLines, detail, noteLines } = m
  ctx.textBaseline = 'alphabetic'

  let y = MARGIN + 54

  const centreText = (text: string, font: string, color: string, spacing = 0) => {
    ctx.font = font
    ctx.fillStyle = color
    ctx.letterSpacing = `${spacing}px`
    ctx.textAlign = 'center'
    ctx.fillText(text, centre, y)
    ctx.letterSpacing = '0px'
    ctx.textAlign = 'left'
  }

  const rule = (color: string, from = left, to = W - left) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(from, y); ctx.lineTo(to, y); ctx.stroke()
  }

  // ── Crest ─────────────────────────────────────────────────────────────────
  ctx.beginPath()
  ctx.arc(centre, y - 5, 21, 0, Math.PI * 2)
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.font = `bold 15px ${SANS}`
  ctx.fillStyle = INK
  ctx.textAlign = 'center'
  ctx.letterSpacing = '2px'
  ctx.fillText('DICE', centre, y)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'
  y += 52

  centreText('CERTIFICATE OF COMPLETION', `bold 12px ${SANS}`, DIM, 4)
  y += 42
  centreText('Incident Response Campaign', `34px ${SERIF}`, INK)
  y += 28

  // Gold rule broken by a centred diamond
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(centre - 150, y); ctx.lineTo(centre - 9, y)
  ctx.moveTo(centre + 9, y);   ctx.lineTo(centre + 150, y)
  ctx.stroke()
  ctx.fillStyle = GOLD
  ctx.beginPath()
  ctx.moveTo(centre, y - 4); ctx.lineTo(centre + 4, y)
  ctx.lineTo(centre, y + 4); ctx.lineTo(centre - 4, y)
  ctx.closePath()
  ctx.fill()
  y += 42

  // ── Recipient ─────────────────────────────────────────────────────────────
  centreText('This certifies that', `italic 15px ${SERIF}`, DIM)
  y += 46

  ctx.font = `bold 36px ${SERIF}`
  centreText(fit(ctx, cert.recipientName, innerW), `bold 36px ${SERIF}`, INK)
  y += 36

  centreText('has completed, in its entirety, the incident response campaign',
    `italic 15px ${SERIF}`, DIM)
  y += 44

  ctx.font = `bold 24px ${SERIF}`
  centreText(fit(ctx, cert.campaignName, innerW), `bold 24px ${SERIF}`, GOLD)
  y += 22

  if (descLines.length) {
    y += 14
    ctx.font = `italic 15px ${SERIF}`
    ctx.fillStyle = DIM
    ctx.textAlign = 'center'
    for (const line of descLines) { ctx.fillText(line, centre, y); y += 22 }
    ctx.textAlign = 'left'
  }
  y += 30

  // ── Headline figures ──────────────────────────────────────────────────────
  const stats: [string, string][] = [
    ['Date Started',   formatDate(cert.startedAt)],
    ['Date Completed', formatDate(cert.completedAt)],
    ['Gameplay Hours', String(cert.totalHours)],
    ['Scenarios',      String(cert.scenarios.length)],
  ]
  const colW = contentW / stats.length
  ctx.textAlign = 'center'
  stats.forEach(([label, value], i) => {
    const x = MARGIN + colW * i + colW / 2
    ctx.font = `bold 10px ${SANS}`
    ctx.fillStyle = DIM
    ctx.letterSpacing = '1.5px'
    ctx.fillText(label.toUpperCase(), x, y)
    ctx.letterSpacing = '0px'
    ctx.font = `bold 22px ${SERIF}`
    ctx.fillStyle = INK
    ctx.fillText(fit(ctx, value, colW - 12), x, y + 30)
  })
  ctx.textAlign = 'left'
  y += 66

  rule(RULE)
  y += 30

  // ── Scenario table ────────────────────────────────────────────────────────
  // Columns are fixed offsets from the content edges; the title column absorbs
  // the slack and the hours column is right-aligned so the figures line up.
  const cNum    = left + 4
  const cTitle  = left + 34
  const cDiff   = W - left - 300
  const cOut    = W - left - 150
  const cHours  = W - left
  const titleW  = cDiff - cTitle - 16

  ctx.font = `bold 10px ${SANS}`
  ctx.fillStyle = DIM
  ctx.letterSpacing = '1.2px'
  ctx.fillText('#', cNum, y)
  ctx.fillText('SCENARIO', cTitle, y)
  ctx.fillText('DIFFICULTY', cDiff, y)
  ctx.fillText('OUTCOME', cOut, y)
  ctx.textAlign = 'right'
  ctx.fillText('HOURS', cHours, y)
  ctx.textAlign = 'left'
  ctx.letterSpacing = '0px'
  y += 10

  rule(INK)
  y += ROW_H - 8

  for (const s of cert.scenarios) {
    ctx.font = `12px ${SANS}`
    ctx.fillStyle = DIM
    ctx.fillText(String(s.position).padStart(2, '0'), cNum, y)

    ctx.font = `bold 14px ${SERIF}`
    ctx.fillStyle = INK
    ctx.fillText(fit(ctx, s.title, titleW), cTitle, y)

    // Filled/hollow pips carry the 1–5 rating; the label beside them says it in
    // words, so the rating survives being printed in greyscale.
    drawPips(ctx, cDiff, y, s.difficulty)
    ctx.font = `11px ${SANS}`
    ctx.fillStyle = DIM
    ctx.fillText(s.difficultyLabel, cDiff + 82, y)

    ctx.font = `12px ${SANS}`
    ctx.fillStyle = INK
    ctx.fillText(OUTCOME_LABEL[s.outcome] ?? s.outcome, cOut, y)

    // An untimed scenario says so rather than claiming zero hours played.
    ctx.textAlign = 'right'
    ctx.fillStyle = s.timed ? INK : DIM
    ctx.font = s.timed ? `bold 14px ${SERIF}` : `11px ${SANS}`
    ctx.fillText(s.timed ? String(s.hours) : 'not recorded', cHours, y)
    ctx.textAlign = 'left'

    // Threat type as a quiet second line — context without another column.
    ctx.font = `10px ${SANS}`
    ctx.fillStyle = DIM
    ctx.fillText(fit(ctx, s.threatType, titleW), cTitle, y + 12)

    y += ROW_H
    ctx.strokeStyle = HAIR
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(left, y - 14); ctx.lineTo(W - left, y - 14); ctx.stroke()
  }

  y += 12
  ctx.font = `11px ${SANS}`
  ctx.fillStyle = DIM
  ctx.textAlign = 'right'
  ctx.fillText(
    `Total measured gameplay: ${cert.totalHours} hour${cert.totalHours === 1 ? '' : 's'}`,
    cHours, y,
  )
  ctx.textAlign = 'left'
  y += 32

  // ── Campaign detail ───────────────────────────────────────────────────────
  rule(RULE)
  y += 26

  const labelW = 150
  for (const [label, value] of detail) {
    ctx.font = `bold 10px ${SANS}`
    ctx.fillStyle = DIM
    ctx.letterSpacing = '1.2px'
    ctx.fillText(label.toUpperCase(), left, y)
    ctx.letterSpacing = '0px'
    ctx.font = `13px ${SANS}`
    ctx.fillStyle = INK
    ctx.fillText(fit(ctx, value, contentW - labelW - 44), left + labelW, y)
    y += 24
  }

  // ── Footnotes ─────────────────────────────────────────────────────────────
  // Drawn from the lines measured above, so what lands here is exactly what the
  // height was reserved for.
  y += 14
  ctx.font = `10px ${SANS}`
  ctx.fillStyle = DIM
  for (const line of noteLines) { ctx.fillText(line, left, y); y += NOTE_LINE_H }

  return y
}

// The paper and its double rule. Separate from paintBody because it is the one
// thing that needs the final height, which paintBody exists to determine.
function paintFrame(ctx: CanvasRenderingContext2D, H: number): void {
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)

  ctx.strokeStyle = INK
  ctx.lineWidth = 3
  ctx.strokeRect(MARGIN * 0.5, MARGIN * 0.5, W - MARGIN, H - MARGIN)
  ctx.strokeStyle = GOLD
  ctx.lineWidth = 1
  ctx.strokeRect(MARGIN * 0.5 + 8, MARGIN * 0.5 + 8, W - MARGIN - 16, H - MARGIN - 16)
}

export function renderCampaignCertificate(cert: CampaignCertificate): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D is unavailable in this browser')

  // Dry run against a throwaway, deliberately unsized context. measureText
  // reports true font metrics whatever the bitmap size, and the drawing calls
  // are simply clipped away — the only thing wanted back is where the cursor
  // ended up. Probing on a full-size bitmap instead would allocate tens of
  // megabytes for marks that are about to be thrown away.
  const probe = document.createElement('canvas').getContext('2d')
  if (!probe) throw new Error('Canvas 2D is unavailable in this browser')
  const measured = measureContent(probe, cert)
  const H = Math.ceil(paintBody(probe, cert, measured) + BOTTOM_PAD)

  canvas.width  = W * SCALE
  canvas.height = H * SCALE
  // Explicit rather than relying on the resize to reset the transform, so a
  // second render can never end up scaled twice.
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(SCALE, SCALE)

  paintFrame(ctx, H)
  paintBody(ctx, cert, measured)

  return canvas
}

// Filesystem-safe filename derived from the campaign and recipient.
function certificateFilename(cert: CampaignCertificate): string {
  const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'campaign'
  return `DICE-Campaign-Certificate-${slug(cert.campaignName)}-${slug(cert.recipientName)}.png`
}

// Renders and hands the PNG to the browser as a download. Mirrors the
// object-URL dance in src/api/client.ts downloadFile so both downloads clean up
// the same way.
export async function downloadCampaignCertificate(cert: CampaignCertificate): Promise<void> {
  const canvas = renderCampaignCertificate(cert)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The browser could not encode the certificate image')

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = certificateFilename(cert)
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
