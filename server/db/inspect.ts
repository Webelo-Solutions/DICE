import { sqlite } from './client'

// Read-only summary of what's actually stored in the SQLite database.
// Run with: npm run db:inspect
function count(table: string): number {
  const row = sqlite.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  return row.n
}

function names(table: string, col: string, limit = 5): string[] {
  return sqlite
    .prepare(`SELECT ${col} AS v FROM ${table} LIMIT ${limit}`)
    .all()
    .map((r: any) => String(r.v))
}

console.log('\n=== DICE database contents (data/dice.db) ===\n')

const rows: Array<[string, number, string]> = [
  ['Characters (roster)', count('characters'), names('characters', 'name').join(', ')],
  ['Campaigns',           count('campaigns'), names('campaigns', 'name').join(', ')],
  ['Custom scenarios',    count('custom_scenarios'), names('custom_scenarios', 'title').join(', ')],
  ['Saved sessions',      count('saves'), names('saves', 'name').join(', ')],
  ['Session history',     count('session_history'), names('session_history', 'scenario_title').join(', ')],
  ['App state (kv)',      count('kv_state'), names('kv_state', 'key').join(', ')],
]

for (const [label, n, sample] of rows) {
  const detail = n > 0 && sample ? `  →  ${sample}` : ''
  console.log(`  ${label.padEnd(22)} ${String(n).padStart(3)} row(s)${detail}`)
}

console.log('\nIf these counts reflect what you created in the app, the data is in the database.\n')
sqlite.close()
