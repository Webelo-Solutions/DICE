// Minimal RFC 4180 CSV writer — quotes a field only when it contains a comma,
// quote, or newline, doubling any embedded quotes.
function csvField(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvField).join(','))
  return lines.join('\r\n') + '\r\n'
}
