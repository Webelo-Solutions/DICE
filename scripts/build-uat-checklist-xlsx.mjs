// Generates the DICE UAT checklist as a trackable Excel workbook:
// docs/DICE-UAT-Checklist.xlsx — same 192 test cases as the Word version
// (scripts/uat-checklist-data.mjs is the shared source), but structured for
// live pass/fail statistics: a Dashboard tab with formulas driven off a
// single flat Checklist tab, plus dropdowns and conditional formatting so
// testers work entirely inside Excel.
// Run: node scripts/build-uat-checklist-xlsx.mjs
import ExcelJS from 'exceljs'
import { mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { SECTIONS } from './uat-checklist-data.mjs'

const root = resolve(import.meta.dirname, '..')
const OUT = resolve(root, 'docs')
mkdirSync(OUT, { recursive: true })

const BANNER = resolve(root, 'public', 'banner.png')

const BRAND_BLUE = 'FF0B5FFF'
const HEADER_FILL = 'FF1F2937'
const HEADER_FONT = 'FFFFFFFF'
const BORDER = { style: 'thin', color: { argb: 'FFB0B7C3' } }
const THIN_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER }

const RESULT_OPTIONS = ['Not Run', 'Pass', 'Fail', 'N/A']
const RESULT_COLORS = {
  Pass:      'FFDCFCE7', // light green
  Fail:      'FFFEE2E2', // light red
  'N/A':     'FFF3F4F6', // light grey
  'Not Run': 'FFFEF3C7', // light amber — flags "still needs attention"
}

const totalCases = SECTIONS.reduce((sum, s) => sum + s.cases.length, 0)
const FIRST_DATA_ROW = 2
const LAST_DATA_ROW = FIRST_DATA_ROW + totalCases - 1
const resultRange = `Checklist!$F$${FIRST_DATA_ROW}:$F$${LAST_DATA_ROW}`

const wb = new ExcelJS.Workbook()
wb.creator = 'DICE'
wb.created = new Date(0)   // fixed timestamp — keeps repeat builds reproducible

// Sheets are added in the order they should appear as tabs: Instructions,
// Dashboard, Checklist. Dashboard's formulas reference "Checklist!..." by
// name (a string), so it's fine that the Checklist sheet is built last.

// ── Instructions sheet ───────────────────────────────────────────────────────
const info = wb.addWorksheet('Instructions', { views: [{ showGridLines: false }] })
info.getColumn(1).width = 3
info.getColumn(2).width = 34
info.getColumn(3).width = 70

let ir = 2
if (existsSync(BANNER)) {
  const imgId = wb.addImage({ filename: BANNER, extension: 'png' })
  info.addImage(imgId, { tl: { col: 1, row: ir - 1 }, ext: { width: 320, height: Math.round((320 * 572) / 1602) } })
  ir += 6
}
info.mergeCells(`B${ir}:C${ir}`)
info.getCell(`B${ir}`).value = 'DICE User Acceptance Testing Checklist'
info.getCell(`B${ir}`).font = { bold: true, size: 16, color: { argb: BRAND_BLUE } }
ir += 1
info.mergeCells(`B${ir}:C${ir}`)
info.getCell(`B${ir}`).value = 'Pre-Production Sign-Off — Excel Tracking Version'
info.getCell(`B${ir}`).font = { italic: true, size: 11, color: { argb: 'FF6B7280' } }
ir += 2

const coverFields = [
  ['DICE Version Under Test', ''],
  ['Test Environment (OS / Browser)', ''],
  ['Install Type (Standalone / LAN)', ''],
  ['Tester Name', ''],
  ['Test Date(s)', ''],
]
for (const [label, val] of coverFields) {
  info.getCell(`B${ir}`).value = label
  info.getCell(`B${ir}`).font = { bold: true }
  info.getCell(`C${ir}`).value = val
  info.getCell(`B${ir}`).border = THIN_BORDERS
  info.getCell(`C${ir}`).border = THIN_BORDERS
  ir += 1
}
ir += 1

info.getCell(`B${ir}`).value = 'How to Use This Workbook'
info.getCell(`B${ir}`).font = { bold: true, size: 13 }
ir += 1

const instructions = [
  'Work through the Checklist tab in order where practical — later sections (multiplayer, admin areas) assume at least one character and one completed session exist.',
  'Every row starts as "Not Run". Change the Result cell (dropdown) to Pass, Fail, or N/A as you complete each test — the cell colors itself and the Dashboard tab updates live.',
  'Use Notes for anything unexpected, even if it doesn\'t fail the step outright. Fill Tester and Date Tested per row if multiple people are testing in parallel.',
  'A test case that cannot be completed due to a blocking defect in an earlier step should be marked Fail with a note referencing the blocker, not left as "Not Run".',
  'Use the Dashboard tab\'s "By Section" table to see which areas still need attention (high "Not Run" counts) and overall pass rate before sign-off.',
  'Recommended test accounts: at least one Admin account and two Player accounts, so multiplayer and permission-boundary cases can be exercised realistically.',
  'Recommended test data: a configured AI provider API key, at least one custom .dicepack file, and a second machine on the same network for LAN hosting checks (Section 21).',
  'Sign-off: ready for production once every applicable row is Pass or N/A with a documented reason, and every Fail has been fixed and re-tested or explicitly accepted as a known issue.',
]
for (const text of instructions) {
  info.mergeCells(`B${ir}:C${ir}`)
  const cell = info.getCell(`B${ir}`)
  cell.value = '•  ' + text
  cell.alignment = { wrapText: true, vertical: 'top' }
  info.getRow(ir).height = Math.ceil(text.length / 90) * 15 + 5
  ir += 1
}
ir += 1

info.getCell(`B${ir}`).value = 'Sign-Off'
info.getCell(`B${ir}`).font = { bold: true, size: 13 }
ir += 1
for (const label of ['Tester — Name / Signature / Date', 'Approver (Product Owner) — Name / Signature / Date']) {
  info.getCell(`B${ir}`).value = label
  info.getCell(`B${ir}`).font = { bold: true }
  info.getCell(`C${ir}`).value = ''
  info.getCell(`B${ir}`).border = THIN_BORDERS
  info.getCell(`C${ir}`).border = THIN_BORDERS
  ir += 1
}

// ── Dashboard sheet ──────────────────────────────────────────────────────────
const dash = wb.addWorksheet('Dashboard', { views: [{ showGridLines: false }] })
dash.getColumn(1).width = 4
dash.getColumn(2).width = 32
for (let c = 3; c <= 10; c++) dash.getColumn(c).width = 12

dash.mergeCells('B2:J2')
dash.getCell('B2').value = 'DICE — User Acceptance Testing Dashboard'
dash.getCell('B2').font = { bold: true, size: 18, color: { argb: BRAND_BLUE } }

dash.mergeCells('B3:J3')
dash.getCell('B3').value = 'Live counts below read directly from the Checklist tab — update Result there and this updates automatically.'
dash.getCell('B3').font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }

// Overall summary block
const SUMMARY_ROW = 5
dash.getCell(`B${SUMMARY_ROW}`).value = 'Overall'
dash.getCell(`B${SUMMARY_ROW}`).font = { bold: true, size: 12 }
const overallHeaderRow = SUMMARY_ROW + 1
const OVERALL_HEADERS = ['Total', 'Pass', 'Fail', 'N/A', 'Not Run', '% Complete', '% Pass']
OVERALL_HEADERS.forEach((h, i) => {
  const cell = dash.getCell(overallHeaderRow, 3 + i)
  cell.value = h
  cell.font = { bold: true, color: { argb: HEADER_FONT } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  cell.border = THIN_BORDERS
  cell.alignment = { horizontal: 'center' }
})
const overallValueRow = overallHeaderRow + 1
dash.getCell(overallValueRow, 3).value = totalCases
dash.getCell(overallValueRow, 4).value = { formula: `COUNTIF(${resultRange},"Pass")` }
dash.getCell(overallValueRow, 5).value = { formula: `COUNTIF(${resultRange},"Fail")` }
dash.getCell(overallValueRow, 6).value = { formula: `COUNTIF(${resultRange},"N/A")` }
dash.getCell(overallValueRow, 7).value = { formula: `COUNTIF(${resultRange},"Not Run")` }
dash.getCell(overallValueRow, 8).value = { formula: `(D${overallValueRow}+E${overallValueRow}+F${overallValueRow})/C${overallValueRow}` }
dash.getCell(overallValueRow, 9).value = { formula: `IF((D${overallValueRow}+E${overallValueRow})=0,0,D${overallValueRow}/(D${overallValueRow}+E${overallValueRow}))` }
for (let c = 3; c <= 9; c++) {
  const cell = dash.getCell(overallValueRow, c)
  cell.border = THIN_BORDERS
  cell.alignment = { horizontal: 'center' }
  cell.font = { bold: c === 3 }
  if (c >= 8) cell.numFmt = '0%'
}

// Per-section breakdown table
const SECTION_TABLE_TITLE_ROW = overallValueRow + 2
dash.getCell(`B${SECTION_TABLE_TITLE_ROW}`).value = 'By Section'
dash.getCell(`B${SECTION_TABLE_TITLE_ROW}`).font = { bold: true, size: 12 }

const sectionHeaderRow = SECTION_TABLE_TITLE_ROW + 1
const SECTION_HEADERS = ['#', 'Section', 'Total', 'Pass', 'Fail', 'N/A', 'Not Run', '% Complete', '% Pass']
SECTION_HEADERS.forEach((h, i) => {
  const cell = dash.getCell(sectionHeaderRow, 2 + i)
  cell.value = h
  cell.font = { bold: true, color: { argb: HEADER_FONT } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  cell.border = THIN_BORDERS
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
})

let r = sectionHeaderRow + 1
const sectionRowStart = r
const sectionColRange = `Checklist!$A$${FIRST_DATA_ROW}:$A$${LAST_DATA_ROW}`
for (const s of SECTIONS) {
  dash.getCell(r, 2).value = s.sectionNo
  dash.getCell(r, 3).value = s.title
  dash.getCell(r, 4).value = { formula: `COUNTIF(${sectionColRange},B${r})` }
  dash.getCell(r, 5).value = { formula: `COUNTIFS(${sectionColRange},B${r},${resultRange},"Pass")` }
  dash.getCell(r, 6).value = { formula: `COUNTIFS(${sectionColRange},B${r},${resultRange},"Fail")` }
  dash.getCell(r, 7).value = { formula: `COUNTIFS(${sectionColRange},B${r},${resultRange},"N/A")` }
  dash.getCell(r, 8).value = { formula: `COUNTIFS(${sectionColRange},B${r},${resultRange},"Not Run")` }
  dash.getCell(r, 9).value = { formula: `(E${r}+F${r}+G${r})/D${r}` }
  dash.getCell(r, 10).value = { formula: `IF((E${r}+F${r})=0,0,E${r}/(E${r}+F${r}))` }
  for (let c = 2; c <= 10; c++) {
    const cell = dash.getCell(r, c)
    cell.border = THIN_BORDERS
    cell.alignment = { horizontal: c === 3 ? 'left' : 'center' }
    if (c >= 9) cell.numFmt = '0%'
  }
  r += 1
}
const sectionRowEnd = r - 1

// Data-bar conditional formatting on the % Complete and % Pass columns —
// a lightweight visual progress indicator without relying on exceljs's
// limited native chart support.
dash.addConditionalFormatting({
  ref: `I${sectionRowStart}:J${sectionRowEnd}`,
  rules: [{
    type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, gradient: true,
    color: { argb: 'FF0B5FFF' },
    cfvo: [{ type: 'min' }, { type: 'max' }],
  }],
})

// ── Checklist sheet ─────────────────────────────────────────────────────────
const checklist = wb.addWorksheet('Checklist', { views: [{ state: 'frozen', ySplit: 1 }] })
checklist.columns = [
  { header: 'Section #',         key: 'sectionNo', width: 10 },
  { header: 'Section',           key: 'section',   width: 30 },
  { header: 'Test ID',           key: 'id',        width: 10 },
  { header: 'Test Case / Steps', key: 'action',    width: 55 },
  { header: 'Expected Result',   key: 'expected',  width: 55 },
  { header: 'Result',            key: 'result',    width: 12 },
  { header: 'Notes',             key: 'notes',     width: 35 },
  { header: 'Tester',            key: 'tester',    width: 16 },
  { header: 'Date Tested',       key: 'date',      width: 14 },
]

const headerRow = checklist.getRow(1)
headerRow.eachCell((cell) => {
  cell.font = { bold: true, color: { argb: HEADER_FONT } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
  cell.border = THIN_BORDERS
  cell.alignment = { vertical: 'middle', wrapText: true }
})

for (const s of SECTIONS) {
  s.cases.forEach(([action, expected], i) => {
    const row = checklist.addRow({
      sectionNo: s.sectionNo,
      section:   s.title,
      id:        `${s.sectionNo}.${i + 1}`,
      action, expected,
      result:    'Not Run',
    })
    row.eachCell((cell, colNumber) => {
      cell.border = THIN_BORDERS
      cell.alignment = { vertical: 'top', wrapText: colNumber === 4 || colNumber === 5 || colNumber === 7 }
    })
  })
}

// Dropdown for Result, and a date format for Date Tested.
checklist.dataValidations.add(`F${FIRST_DATA_ROW}:F${LAST_DATA_ROW}`, {
  type: 'list', allowBlank: false, formulae: [`"${RESULT_OPTIONS.join(',')}"`],
  showErrorMessage: true, errorTitle: 'Invalid result', error: 'Choose one of: ' + RESULT_OPTIONS.join(', '),
})
checklist.getColumn('date').numFmt = 'yyyy-mm-dd'

// Conditional formatting on the Result column — visual feedback as testers fill it in.
for (const [value, color] of Object.entries(RESULT_COLORS)) {
  checklist.addConditionalFormatting({
    ref: `F${FIRST_DATA_ROW}:F${LAST_DATA_ROW}`,
    rules: [{
      type: 'cellIs', operator: 'equal', formulae: [`"${value}"`], priority: 1,
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: color } } },
    }],
  })
}

checklist.autoFilter = { from: { row: 1, column: 1 }, to: { row: LAST_DATA_ROW, column: 9 } }

wb.views = [{ activeTab: 0 }]   // open on the Instructions tab

const outPath = resolve(OUT, 'DICE-UAT-Checklist.xlsx')
await wb.xlsx.writeFile(outPath)

console.log(`✓ Wrote ${outPath}`)
console.log(`  ${SECTIONS.length} sections, ${totalCases} test cases across 3 tabs (Instructions, Dashboard, Checklist)`)
