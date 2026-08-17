// Shared JSON parsing for AI-generated responses. Providers are asked to
// return strict JSON, but occasionally emit a literal control character
// (most often a raw newline in a narration field) instead of the required
// \n escape — technically invalid JSON that makes JSON.parse throw
// "Bad control character in string literal". escapeRawControlCharsInStrings
// repairs that by escaping control characters ONLY when they appear inside
// a string literal, leaving structural whitespace between JSON tokens alone.
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

// Strips a wrapping ```json ... ``` fence (providers add this despite being
// told not to), then parses. Malformed control characters are repaired on
// a retry pass rather than upfront, so the common well-formed case pays no
// extra cost. Throws a diagnostic error (with a raw snippet) if both passes fail.
export function parseLLMJson<T = unknown>(raw: string, label = 'response'): T {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try {
    return JSON.parse(stripped) as T
  } catch {
    // fall through to the repair pass
  }
  try {
    return JSON.parse(escapeRawControlCharsInStrings(stripped)) as T
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(`Could not parse ${label} as JSON (${reason}). Raw: ${stripped.slice(0, 300)}`)
  }
}
