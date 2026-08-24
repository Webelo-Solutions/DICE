import { CERTIFICATE_BACKGROUND_PNG_BASE64 } from './backgroundAsset'
import { CERTIFICATE_LOGO_PNG_BASE64 } from './logoAsset'
import { CEO_SIGNATURE_PNG_BASE64 } from './signatureAsset'

// Shared visual language for every DICE certificate — the CPE certificate of
// attendance and the campaign completion certificate both use this, so a
// palette or asset change only has to happen once.

// Source pixel dimensions of the embedded assets — needed to scale each one
// without distorting it (pdfkit only distorts if you feed it a width/height
// pair that doesn't match the source aspect ratio).
const BACKGROUND_SIZE  = { width: 1280, height: 726 }
const LOGO_ASPECT      = 1470 / 1345
const SIGNATURE_ASPECT = 423 / 1025

// Dark hexagon photo, full-bleed. Its brightness runs from a near-white hot
// spot top-left to near-black bottom-right, so text color can't just be
// "light" — a translucent dark card sits between the photo and every line of
// text (see CARD_BG below) to flatten that gradient into one readable tone.
export const ACCENT = '#F6931E'
export const INK    = '#F3F6F5'
export const DIM    = '#AFC2BC'
export const RULE   = '#4C6960'
const CARD_BG      = '#050F0C'
const CARD_OPACITY = 0.72

// Full-bleed photo, scaled to COVER the page rather than stretched to fit
// it — the photo's aspect ratio (1280×726) isn't the page's, so forcing both
// dimensions would distort every hexagon into an oval. It's scaled uniformly
// by whichever axis needs the larger factor, centered, and the overflow is
// clipped to the page edge.
//
// Then a translucent dark card over the whole content area: without it, light
// text sitting over the photo's bright top-left corner would wash out, and
// dark text over the near-black right side would vanish. The Webelo badge
// sits on the card, top-right, as the issuing mark.
//
// Registers itself on 'pageAdded' too — a certificate is meant to be one
// page, but a long title or name wrapping an extra line should never spill
// onto a second page that silently reverts to plain white, breaking the
// design the first page promised.
export function paintCertificateBackground(doc: PDFKit.PDFDocument, contentWidth: number): void {
  const paint = () => {
    doc.save()
    doc.rect(0, 0, doc.page.width, doc.page.height).clip()
    const coverScale = Math.max(doc.page.width / BACKGROUND_SIZE.width, doc.page.height / BACKGROUND_SIZE.height)
    const drawWidth  = BACKGROUND_SIZE.width * coverScale
    const drawHeight = BACKGROUND_SIZE.height * coverScale
    doc.image(
      Buffer.from(CERTIFICATE_BACKGROUND_PNG_BASE64, 'base64'),
      (doc.page.width - drawWidth) / 2, (doc.page.height - drawHeight) / 2,
      { width: drawWidth, height: drawHeight },
    )
    doc.restore()

    const cardPad = 22
    doc.roundedRect(
      doc.page.margins.left - cardPad,
      doc.page.margins.top - cardPad,
      contentWidth + cardPad * 2,
      doc.page.height - doc.page.margins.top - doc.page.margins.bottom + cardPad * 2,
      12,
    ).fillOpacity(CARD_OPACITY).fill(CARD_BG)
    doc.fillOpacity(1)

    const logoHeight = 46
    const logoWidth  = logoHeight * LOGO_ASPECT
    doc.image(
      Buffer.from(CERTIFICATE_LOGO_PNG_BASE64, 'base64'),
      doc.page.width - doc.page.margins.right - logoWidth, doc.page.margins.top - 4,
      { width: logoWidth, height: logoHeight },
    )
  }
  doc.on('pageAdded', paint)
  paint()
}

// The named, reachable signer an auditor or recipient can point at — both
// certificate types are issued under the same authority. signature.png is a
// muted tone drawn to sit directly on the dark card; unlike a black-ink scan,
// it doesn't need a light plate behind it. Draws at the current cursor
// (doc.x fixed at `x`, doc.y wherever it already was) and leaves doc.y just
// past the bottom of the block.
export function drawSignatureBlock(doc: PDFKit.PDFDocument, x: number): void {
  const sigWidth = 105
  const sigHeight = sigWidth * SIGNATURE_ASPECT
  const textBlockWidth = sigWidth + 40

  const imageTop = doc.y
  const sigLineY = imageTop + sigHeight + 4
  const nameY = sigLineY + 4

  doc.image(Buffer.from(CEO_SIGNATURE_PNG_BASE64, 'base64'), x, imageTop, { width: sigWidth })
  doc.moveTo(x, sigLineY).lineTo(x + sigWidth, sigLineY).strokeColor(RULE).lineWidth(1).stroke()
  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text('K.C. Yerrid, CEO', x, nameY, { width: textBlockWidth })
  doc.font('Helvetica').fontSize(8).fillColor(DIM).text('Webelo Solutions, LLC', x, doc.y, { width: textBlockWidth })
  doc.y = Math.max(doc.y, imageTop + sigHeight) + 6
}
