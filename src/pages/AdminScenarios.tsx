import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiAdmin } from '../api/admin'
import type { CustomScenario } from '../types/campaign'
import { ScenarioEditorForm, blankScenario } from './CampaignBuilder'

// /admin/scenarios — gated by RequireAdmin in App.tsx. Full scenario editor
// (reuses CampaignBuilder's ScenarioEditorForm as-is), but operates on every
// scenario on the install rather than just the caller's own — saves always
// mark the scenario is_global so it becomes visible to every user.
export function AdminScenarios() {
  const navigate = useNavigate()
  const [scenarios, setScenarios] = useState<CustomScenario[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CustomScenario | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const flash = (kind: 'success' | 'error', text: string) => {
    setMsg({ kind, text })
    setTimeout(() => setMsg((m) => (m?.text === text ? null : m)), 4000)
  }

  const load = async () => {
    setLoading(true)
    try { setScenarios(await apiAdmin.listAllScenarios()) }
    catch (e) { flash('error', (e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleNew = () => {
    setDraft(blankScenario())
    setSelectedId(null)
  }
  const handleSelect = (id: string) => {
    setSelectedId(id)
    setDraft(null)
  }
  const handleSave = async (s: CustomScenario) => {
    try {
      const saved = await apiAdmin.upsertScenario(s)
      flash('success', `Saved "${saved.title || saved.id}"`)
      setDraft(null)
      setSelectedId(saved.id)
      await load()
    } catch (e) { flash('error', (e as Error).message) }
  }
  const handleDelete = async () => {
    if (!selectedId) return
    if (!window.confirm('Delete this scenario for everyone on the install?')) return
    try {
      await apiAdmin.deleteScenario(selectedId)
      flash('success', 'Deleted')
      setSelectedId(null)
      await load()
    } catch (e) { flash('error', (e as Error).message) }
  }

  const isNew  = draft !== null
  const active = isNew ? draft : scenarios.find((s) => s.id === selectedId) ?? null

  return (
    <div className="h-screen flex flex-col bg-terminal-bg font-mono">
      <div className="flex items-center justify-between px-6 py-4 border-b border-terminal-border">
        <div>
          <button onClick={() => navigate('/admin/users')} className="text-xs text-terminal-dim hover:text-terminal-green transition-colors">
            ← Back to Admin
          </button>
          <div className="text-[10px] text-terminal-dim tracking-widest uppercase mt-1">Admin</div>
          <h1 className="text-lg font-bold text-white">Scenarios</h1>
        </div>
        <button
          onClick={handleNew}
          className="px-3 py-1.5 text-xs font-semibold tracking-widest uppercase
            bg-terminal-green/10 border border-terminal-green/40 text-terminal-green
            hover:bg-terminal-green/20 hover:border-terminal-green rounded transition-all"
        >
          + New Scenario
        </button>
      </div>

      {msg && (
        <div className={`mx-6 mt-4 rounded border p-3 text-[11px] ${msg.kind === 'success'
          ? 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green'
          : 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red'}`}>
          {msg.text}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="w-64 flex-shrink-0 border-r border-terminal-border flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-xs text-terminal-dim">Loading…</div>
            ) : scenarios.length === 0 ? (
              <div className="p-4 text-xs text-terminal-dim">No scenarios yet.</div>
            ) : scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelect(s.id)}
                className={`w-full text-left px-4 py-3 border-b border-terminal-border/50 transition-colors ${
                  !isNew && selectedId === s.id
                    ? 'border-l-2 border-l-terminal-green bg-terminal-surface'
                    : 'hover:bg-terminal-surface/50'
                }`}
              >
                <div className="text-xs text-white truncate">{s.title || '(untitled)'}</div>
                <div className="text-[10px] text-terminal-dim truncate">{s.id}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {active ? (
            <ScenarioEditorForm
              key={isNew ? 'new' : active.id}
              initial={active}
              onSave={handleSave}
              onDelete={!isNew ? handleDelete : undefined}
              isNew={isNew}
            />
          ) : (
            <div className="text-sm text-terminal-dim">Select a scenario, or create a new one.</div>
          )}
        </div>
      </div>
    </div>
  )
}
