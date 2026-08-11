// Generates a comprehensive User Acceptance Testing checklist for DICE as an
// editable Word document: docs/DICE-UAT-Checklist.docx
// Run: node scripts/build-uat-checklist.mjs
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun, PageBreak,
} from 'docx'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { SECTIONS } from './uat-checklist-data.mjs'

const root = resolve(import.meta.dirname, '..')
const OUT = resolve(root, 'docs')
mkdirSync(OUT, { recursive: true })

const BANNER = resolve(root, 'public', 'banner.png')
const bannerBuf = existsSync(BANNER) ? readFileSync(BANNER) : null
const BANNER_W = 1602, BANNER_H = 572

// ── DOCX rendering ─────────────────────────────────────────────────────────────
function cell(text, { header = false, bold = false, width } = {}) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    shading: header ? { fill: '1F2937' } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: bold || header, color: header ? 'FFFFFF' : '000000', size: 19 })] })],
  })
}

function infoTable(headers, rows, weights) {
  const w = weights || headers.map(() => 100 / headers.length)
  const b = { style: BorderStyle.SINGLE, size: 4, color: 'B0B7C3' }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, { header: true, width: w[i] })) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, { bold: i === 0, width: w[i] })) })),
    ],
  })
}

// Columns: # | Test Case / Steps | Expected Result | Pass / Fail / N/A | Notes
const CHECKLIST_WEIGHTS = [6, 32, 32, 15, 15]
function checklistTable(sectionNo, cases) {
  const b = { style: BorderStyle.SINGLE, size: 4, color: 'B0B7C3' }
  const headerRow = new TableRow({
    tableHeader: true,
    children: ['#', 'Test Case / Steps', 'Expected Result', 'Result', 'Notes']
      .map((t, i) => cell(t, { header: true, width: CHECKLIST_WEIGHTS[i] })),
  })
  const rows = cases.map(([action, expected], i) => new TableRow({
    children: [
      cell(`${sectionNo}.${i + 1}`, { bold: true, width: CHECKLIST_WEIGHTS[0] }),
      cell(action, { width: CHECKLIST_WEIGHTS[1] }),
      cell(expected, { width: CHECKLIST_WEIGHTS[2] }),
      cell('☐ Pass   ☐ Fail   ☐ N/A', { width: CHECKLIST_WEIGHTS[3] }),
      cell('', { width: CHECKLIST_WEIGHTS[4] }),
    ],
  }))
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b },
    rows: [headerRow, ...rows],
  })
}

function buildDocument() {
  const children = []

  // ── Cover page ──
  if (bannerBuf) {
    const w = 460, h = Math.round((w * BANNER_H) / BANNER_W)
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 800, after: 200 },
      children: [new ImageRun({ data: bannerBuf, type: 'png', transformation: { width: w, height: h } })] }))
  }
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: bannerBuf ? 200 : 1200, after: 60 },
      children: [new TextRun({ text: 'DICE', bold: true, size: 30, color: '6B7280' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
      children: [new TextRun({ text: 'User Acceptance Testing Checklist', bold: true, size: 52, color: '0B5FFF' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
      children: [new TextRun({ text: 'Pre-Production Sign-Off', size: 28, color: '374151' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 },
      children: [new TextRun({ text: 'Defensive Incident Containment Exercises', italics: true, size: 22, color: '6B7280' })] }),
  )
  children.push(infoTable(
    ['Field', 'Value'],
    [
      ['DICE Version Under Test', ''],
      ['Test Environment (OS / Browser)', ''],
      ['Install Type (Standalone / LAN)', ''],
      ['Tester Name', ''],
      ['Test Date(s)', ''],
      ['Overall Result (Pass / Pass with issues / Fail)', ''],
    ],
    [45, 55],
  ))
  children.push(new Paragraph({ text: '', spacing: { after: 200 } }))
  children.push(pageBreakBlock())

  // ── Instructions ──
  children.push(new Paragraph({ text: 'How to Use This Checklist', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 160 } }))
  children.push(new Paragraph({ children: [new TextRun(
    'Work through each section in order where practical — later sections (multiplayer, admin areas) assume at least one character and one completed session exist. Mark each row Pass, Fail, or N/A, and use Notes for anything unexpected, even if it doesn\'t fail the step outright. A test case that cannot be completed due to a blocking defect in an earlier step should be marked Fail with a note referencing the blocker, not skipped silently.'
  )], spacing: { after: 160 } }))
  children.push(new Paragraph({ children: [
    new TextRun({ text: 'Recommended test accounts: ', bold: true }),
    new TextRun('at least one Admin account and two Player accounts, so multiplayer and permission-boundary cases can be exercised realistically (one signed-in session per browser or browser profile).'),
  ], spacing: { after: 120 } }))
  children.push(new Paragraph({ children: [
    new TextRun({ text: 'Recommended test data: ', bold: true }),
    new TextRun('a configured AI provider API key (Section 11 onward requires live DM narration), at least one custom .dicepack file for import testing, and access to a second physical or virtual machine on the same network for LAN hosting checks (Section 21).'),
  ], spacing: { after: 120 } }))
  children.push(new Paragraph({ children: [
    new TextRun({ text: 'Sign-off: ', bold: true }),
    new TextRun('this checklist is ready for production sign-off once every applicable row is Pass or N/A with a documented reason, and every Fail has either been fixed and re-tested or explicitly accepted as a known issue by the product owner.'),
  ], spacing: { after: 200 } }))
  children.push(pageBreakBlock())

  // ── Checklist sections ──
  for (const s of SECTIONS) {
    children.push(new Paragraph({ text: `${s.sectionNo}. ${s.title}`, heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 140 } }))
    children.push(checklistTable(s.sectionNo, s.cases))
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }))
  }

  // ── Sign-off ──
  children.push(pageBreakBlock())
  children.push(new Paragraph({ text: 'Sign-Off', heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 160 } }))
  children.push(new Paragraph({ children: [new TextRun(
    'By signing below, the tester and approver confirm the results recorded in this checklist accurately reflect the tested build, and that all Fail items have been resolved, re-tested, or explicitly accepted as known issues.'
  )], spacing: { after: 240 } }))
  children.push(infoTable(
    ['Role', 'Name / Signature', 'Date'],
    [
      ['Tester', '', ''],
      ['Approver (Product Owner)', '', ''],
    ],
    [25, 50, 25],
  ))

  return new Document({ sections: [{ children }] })
}

function pageBreakBlock() {
  return new Paragraph({ children: [new PageBreak()] })
}

const doc = buildDocument()
const outPath = resolve(OUT, 'DICE-UAT-Checklist.docx')
writeFileSync(outPath, await Packer.toBuffer(doc))

const totalCases = SECTIONS.reduce((sum, s) => sum + s.cases.length, 0)
console.log(`✓ Wrote ${outPath}`)
console.log(`  ${SECTIONS.length} sections, ${totalCases} test cases` + (bannerBuf ? '  (with banner)' : '  (no banner found)'))
