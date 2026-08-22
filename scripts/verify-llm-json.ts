// Verifies parseLLMJson against the malformed output models actually produce.
//
// The repair passes are heuristics, so this suite pulls in two directions:
// they must recover the real-world breakages (a DM turn is lost otherwise),
// and they must never alter a response that was already valid. The second is
// the one worth guarding — a repair that silently rewrites good narration is
// worse than the parse error it replaced.
//
//   npm run verify:llm-json

import { parseLLMJson } from '../src/engine/llmJson'

let failures = 0
function check(label: string, ok: boolean, detail = ''): void {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

function parses(label: string, raw: string, expect: (v: any) => boolean, detail = ''): void {
  try {
    const v = parseLLMJson<any>(raw, 'test')
    check(label, expect(v), detail)
  } catch (e) {
    check(label, false, `threw: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`)
  }
}

console.log('\nparseLLMJson\n')

console.log('Well-formed input is untouched')
parses('plain object', '{"narration":"All clear.","dcHint":12}',
  (v) => v.narration === 'All clear.' && v.dcHint === 12)
parses('```json fence stripped', '```json\n{"narration":"Fenced."}\n```',
  (v) => v.narration === 'Fenced.')
parses('bare ``` fence stripped', '```\n{"narration":"Fenced."}\n```',
  (v) => v.narration === 'Fenced.')
parses('correctly escaped quotes survive verbatim',
  '{"narration":"The alert reads \\"Impossible Travel\\" in red."}',
  (v) => v.narration === 'The alert reads "Impossible Travel" in red.')
parses('escaped backslash before a quote is not miscounted',
  '{"path":"C:\\\\logs\\\\","next":"ok"}',
  (v) => v.path === 'C:\\logs\\' && v.next === 'ok')
parses('nested objects and arrays',
  '{"stateChanges":{"complicationsAdded":["a","b"],"actChange":null},"n":1}',
  (v) => v.stateChanges.complicationsAdded.length === 2 && v.n === 1)

console.log('\nRaw control characters (pre-existing repair)')
parses('raw newline inside a string',
  '{"narration":"Line one\nLine two"}',
  (v) => v.narration === 'Line one\nLine two')
parses('raw tab inside a string',
  '{"narration":"col1\tcol2"}',
  (v) => v.narration === 'col1\tcol2')

console.log('\nUnescaped interior quotes (the reported NOVICE-03 failure)')
parses('SIEM alert quoted inside narration',
  '{"narration":"The console reads "Impossible Travel Detected — dcooper@company.com" in red.","dcHint":12}',
  (v) => v.narration.includes('Impossible Travel Detected') && v.dcHint === 12)
parses('NPC dialogue with a comma after the closing quote',
  '{"narration":"Dave leans over: "That London session is still live," he says. Revoke it.","dcHint":14}',
  (v) => v.narration.includes('still live') && v.narration.includes('Revoke it.') && v.dcHint === 14,
  'the hard case: interior quote followed by a comma')
parses('interior quotes in a non-final field',
  '{"narration":"He said "go" now.","nextPrompt":"What do you do?","dcHint":10}',
  (v) => v.nextPrompt === 'What do you do?' && v.dcHint === 10)
parses('interior quote immediately before the closing brace',
  '{"narration":"Marked as "resolved""}',
  (v) => v.narration === 'Marked as "resolved"')
parses('interior quotes plus a raw newline together',
  '{"narration":"Alert: "Impossible Travel"\nAction required."}',
  (v) => v.narration.includes('Impossible Travel') && v.narration.includes('\n'),
  'exercises the combined repair rung')

console.log('\nRealistic full DM payload')
const dmPayload = '{\n"narration": "' + 'The SIEM console refreshes. '.repeat(45)
  + 'Dave in IT Ops leans over: "That London session is still live," he says.", '
  + '"mechanicalOutcome": {"dcAssigned": 12, "outcomeTier": "success", "rollSummary": "14 vs DC 12"}, '
  + '"stateChanges": {"complicationsAdded": [], "scenarioClockDeltaMinutes": -5}, '
  + '"nextPrompt": "What do you do?", "dcHint": 12}'
parses('full DM response with interior quotes past offset 1400', dmPayload,
  (v) => v.mechanicalOutcome.dcAssigned === 12
    && v.stateChanges.scenarioClockDeltaMinutes === -5
    && v.nextPrompt === 'What do you do?'
    && v.narration.includes('still live'))

console.log('\nArrays of strings')
parses('array elements keep their commas',
  '{"complicationsAdded":["Session still live","MFA not enforced"],"n":2}',
  (v) => v.complicationsAdded.length === 2 && v.complicationsAdded[1] === 'MFA not enforced')

console.log('\nUnrecoverable input still fails loudly')
let threw = false
let message = ''
try {
  parseLLMJson('{\n"narration": "' + 'x'.repeat(1400) + ' and then it just stops', 'DM response')
} catch (e) {
  threw = true
  message = e instanceof Error ? e.message : String(e)
}
check('truncated response throws rather than inventing a value', threw)
check('error names the label', message.includes('DM response'))
check('error reports the payload length', /Length \d+/.test(message))
check('error shows the fault region, not just the first 300 chars',
  message.includes('▶HERE◀'), message.slice(0, 100))
check('fault region is near the end, where the truncation is',
  message.indexOf('▶HERE◀') > 0 && message.includes('and then it just stops'))

console.log('\nNo silent corruption')
// The strongest guarantee: anything that parsed strictly must come back
// byte-identical, so no repair can ever touch a healthy response.
const healthy = [
  '{"a":"plain"}',
  '{"a":"with \\"escaped\\" quotes"}',
  '{"a":"comma, inside","b":"and: a colon"}',
  '{"a":["x","y"],"b":{"c":"d"}}',
  '{"a":"braces } and ] inside a string"}',
  '{"a":"a \\"key\\": value lookalike, \\"b\\": 2"}',
]
let identical = true
for (const src of healthy) {
  const got = JSON.stringify(parseLLMJson(src, 'test'))
  const want = JSON.stringify(JSON.parse(src))
  if (got !== want) { identical = false; console.log(`         differs: ${src} -> ${got}`) }
}
check('valid JSON round-trips unchanged through the parser', identical,
  `${healthy.length} payloads`)

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}\n`)
process.exit(failures === 0 ? 0 : 1)
