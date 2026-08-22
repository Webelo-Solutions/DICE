// Shared JSON parsing for AI-generated responses. Providers are asked to
// return strict JSON and usually do, but two failure modes show up often
// enough in play to be worth repairing rather than losing the player's turn:
//
//   1. A literal control character inside a string — most often a raw newline
//      in a narration field instead of the required \n escape. JSON.parse
//      reports "Bad control character in string literal".
//
//   2. An unescaped double quote inside a string value. The DM narrates SIEM
//      alerts and NPC dialogue, both of which are naturally written in quotes
//      ("Impossible Travel Detected — ..."), and models routinely forget to
//      escape them. JSON.parse reports "Expected ',' or '}' after property
//      value", which is what a player sees as a DM connection error.
//
// Both repairs run only after a strict parse has already failed, so a
// well-formed response pays nothing for them.

// Escapes control characters ONLY when they appear inside a string literal,
// leaving structural whitespace between JSON tokens alone.
function escapeRawControlCharsInStrings(text: string): string {
  let result = ''
  let inString = false
  let escapeNext = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escapeNext) {
        result += ch
        escapeNext = false
        continue
      }
      if (ch === '\\') {
        result += ch
        escapeNext = true
        continue
      }
      if (ch === '"') {
        result += ch
        inString = false
        continue
      }
      const code = text.charCodeAt(i)
      if (code < 0x20) {
        switch (ch) {
          case '\n': result += '\\n'; break
          case '\r': result += '\\r'; break
          case '\t': result += '\\t'; break
          default:   result += '\\u' + code.toString(16).padStart(4, '0')
        }
        continue
      }
      result += ch
    } else {
      result += ch
      if (ch === '"') inString = true
    }
  }
  return result
}

// Escapes double quotes that appear *inside* a string value rather than ending
// it. Whether a given quote closes its string can only be judged from what
// follows: a real closing quote is followed by ':' (it was a key), by '}' or
// ']', or by ',' with another key/element after it. Anything else — a letter,
// the rest of a sentence — means the model left an interior quote unescaped.
//
// This is a heuristic, and it is deliberately conservative: when it guesses
// wrong the result fails to parse and the caller reports the original error,
// rather than silently returning subtly wrong narration. It runs only as a
// repair pass, never on input that already parsed.
function escapeInteriorQuotesInStrings(text: string): string {
  const skipSpace = (from: number): number => {
    let j = from
    while (j < text.length && /\s/.test(text[j])) j++
    return j
  }

  // Scans from the opening quote at `start` to the quote that ends that token,
  // honouring backslash escapes. Used to look past a candidate key.
  const endOfQuotedToken = (start: number): number => {
    let j = start + 1
    while (j < text.length) {
      if (text[j] === '\\') { j += 2; continue }
      if (text[j] === '"') return j
      j++
    }
    return -1
  }

  let result = ''
  let inString = false
  let escapeNext = false
  const containers: ('object' | 'array')[] = []

  const closesString = (i: number): boolean => {
    const j = skipSpace(i + 1)
    if (j >= text.length) return true                      // end of input
    const c = text[j]
    if (c === ':' || c === '}' || c === ']') return true
    if (c !== ',') return false                            // prose follows — interior quote

    const k = skipSpace(j + 1)
    if (k >= text.length) return true
    // Inside an array the comma introduces the next element, whatever its type.
    if (containers[containers.length - 1] === 'array') return true
    // Inside an object it must introduce a quoted key, so require "..." then ':'.
    if (text[k] !== '"') return false
    const keyEnd = endOfQuotedToken(k)
    if (keyEnd === -1) return false
    return text[skipSpace(keyEnd + 1)] === ':'
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escapeNext) { result += ch; escapeNext = false; continue }
      if (ch === '\\') { result += ch; escapeNext = true; continue }
      if (ch === '"') {
        if (closesString(i)) { result += ch; inString = false }
        else result += '\\"'
        continue
      }
      result += ch
    } else {
      if (ch === '"') inString = true
      else if (ch === '{') containers.push('object')
      else if (ch === '[') containers.push('array')
      else if (ch === '}' || ch === ']') containers.pop()
      result += ch
    }
  }
  return result
}

// Repairs are tried in order of how much they assume about the input. Quotes
// are repaired before control characters because fixing string boundaries first
// lets the control-character pass see which characters are actually inside a
// string.
const REPAIRS: ((text: string) => string)[] = [
  escapeRawControlCharsInStrings,
  escapeInteriorQuotesInStrings,
  (text) => escapeRawControlCharsInStrings(escapeInteriorQuotesInStrings(text)),
]

// Quotes the region around the offset JSON.parse complained about. The previous
// version showed the first 300 characters, which for a fault at offset ~1500 —
// the usual case, since narration is long — showed nothing relevant at all.
function faultContext(text: string, message: string): string {
  const at = /at position (\d+)/.exec(message)
  if (!at) return `${text.slice(0, 200)}${text.length > 200 ? '…' : ''}`

  const pos = Math.min(Number(at[1]), text.length)
  const from = Math.max(0, pos - 140)
  const to   = Math.min(text.length, pos + 140)
  return (from > 0 ? '…' : '')
    + text.slice(from, pos)
    + ' ▶HERE◀ '
    + text.slice(pos, to)
    + (to < text.length ? '…' : '')
}

// Strips a wrapping ```json ... ``` fence (providers add this despite being
// told not to), then parses, repairing common malformations on failure.
// Throws a diagnostic error pointing at the offending region if nothing works.
export function parseLLMJson<T = unknown>(raw: string, label = 'response'): T {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  let firstError: unknown
  try {
    return JSON.parse(stripped) as T
  } catch (err) {
    firstError = err
  }

  for (const repair of REPAIRS) {
    try {
      return JSON.parse(repair(stripped)) as T
    } catch {
      // try the next repair
    }
  }

  // Report the *original* fault. A repair pass can move the offset around, and
  // the unrepaired position is the one that describes what the model sent.
  const reason = firstError instanceof Error ? firstError.message : String(firstError)
  throw new Error(
    `Could not parse ${label} as JSON (${reason}). `
    + `Length ${stripped.length}. Near the fault: ${faultContext(stripped, reason)}`,
  )
}
