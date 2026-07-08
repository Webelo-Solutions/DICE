import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { refreshLibrary } from '../api/sync'
import { useCampaignStore } from '../store/campaignStore'
import { useGameStore } from '../store/gameStore'
import { buildPackForExport, downloadPack } from '../content/exportPack'
import type { ContentPackSummary } from '../types/contentPack'

type Msg = { kind: 'success' | 'error'; lines: string[] } | null

export function ContentPacks() {
  const navigate = useNavigate()
  const [packs, setPacks]   = useState<ContentPackSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState(false)
  const [msg, setMsg]       = useState<Msg>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Export / create a pack ──
  const customScenarios = useCampaignStore((s) => s.customScenarios)
  const roster = useGameStore((s) => s.roster)
  const [showExport, setShowExport] = useState(false)
  const [exId, setExId]     = useState('')
  const [exName, setExName] = useState('')
  const [exVer, setExVer]   = useState('1.0.0')
  const [exAuthor, setExAuthor] = useState('')
  const [exDesc, setExDesc] = useState('')
  const [exScenarios, setExScenarios] = useState<Set<string>>(new Set())
  const [exChars, setExChars] = useState<Set<string>>(new Set())
  const [exMsg, setExMsg] = useState<Msg>(null)

  const toggleIn = (set: Set<string>, id: string) => {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  }

  const doExport = () => {
    setExMsg(null)
    const scenarios = customScenarios.filter((s) => exScenarios.has(s.id))
    const characters = roster.filter((c) => exChars.has(c.id))
    if (scenarios.length === 0 && characters.length === 0) {
      setExMsg({ kind: 'error', lines: ['Select at least one scenario or character to include.'] })
      return
    }
    const result = buildPackForExport(
      { id: exId, name: exName, version: exVer, author: exAuthor, description: exDesc },
      scenarios, characters,
    )
    if (!result.ok) {
      setExMsg({ kind: 'error', lines: ['Could not build the pack:', ...result.errors] })
      return
    }
    downloadPack(result.pack, result.pack.pack.id)
    setExMsg({ kind: 'success', lines: [`Exported "${result.pack.pack.name}" — ${scenarios.length} scenario(s), ${characters.length} character(s). Check your downloads.`] })
  }

  const load = async () => {
    setLoading(true)
    try { setPacks(await api.listContentPacks()) }
    catch (e) { setMsg({ kind: 'error', lines: [(e as Error).message] }) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const onFile = async (file: File) => {
    setBusy(true); setMsg(null)
    try {
      const text = await file.text()
      let parsed: unknown
      try { parsed = JSON.parse(text) }
      catch { setMsg({ kind: 'error', lines: ['That file is not valid JSON — a .dicepack must be a JSON file.'] }); return }
      const result = await api.importContentPack(parsed)
      if (result.ok) {
        setMsg({ kind: 'success', lines: [`Installed "${result.pack.name}" v${result.pack.version} — ${result.pack.scenarioCount} scenario(s), ${result.pack.characterCount} character(s).`] })
        await refreshLibrary()
        await load()
      } else {
        setMsg({ kind: 'error', lines: ['Pack rejected:', ...result.errors] })
      }
    } catch (e) {
      setMsg({ kind: 'error', lines: [(e as Error).message] })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const toggle = async (p: ContentPackSummary) => {
    setBusy(true)
    try { await api.setContentPackEnabled(p.id, !p.enabled); await refreshLibrary(); await load() }
    catch (e) { setMsg({ kind: 'error', lines: [(e as Error).message] }) }
    finally { setBusy(false) }
  }

  const uninstall = async (p: ContentPackSummary) => {
    if (!window.confirm(`Uninstall "${p.name}"? Its ${p.scenarioCount} scenario(s) and ${p.characterCount} character(s) will be removed.`)) return
    setBusy(true)
    try { await api.uninstallContentPack(p.id); await refreshLibrary(); await load() }
    catch (e) { setMsg({ kind: 'error', lines: [(e as Error).message] }) }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono p-6">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/')} className="text-xs text-terminal-dim hover:text-terminal-green transition-colors">
          ← Back to Home
        </button>

        <div>
          <div className="text-[10px] text-terminal-dim tracking-widest uppercase">Library</div>
          <h1 className="text-xl font-bold text-white">Content Packs</h1>
          <p className="text-[11px] text-terminal-dim mt-1 leading-relaxed">
            Install scenarios and characters shared as <code>.dicepack</code> files — no reinstall needed.
            Imported scenarios appear under Select Scenario; imported characters in your Roster.
          </p>
        </div>

        {/* Import */}
        <div className="rounded border border-terminal-green/30 bg-terminal-green/5 p-5 text-center">
          <input
            ref={fileRef}
            type="file"
            accept=".dicepack,.json,application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="px-5 py-2.5 rounded border border-terminal-green bg-terminal-green/10 text-terminal-green
              font-bold text-sm tracking-widest uppercase hover:bg-terminal-green/20
              disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {busy ? 'Working…' : '↥ Import a .dicepack file'}
          </button>
          <div className="text-[10px] text-terminal-dim/70 mt-3">Only import packs from sources you trust.</div>
        </div>

        {/* Result message */}
        {msg && (
          <div className={`rounded border p-3 text-[11px] leading-relaxed ${msg.kind === 'success'
            ? 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green'
            : 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red'}`}>
            {msg.lines.map((l, i) => <div key={i} className={i === 0 ? 'font-bold' : 'opacity-80'}>{l}</div>)}
          </div>
        )}

        {/* Installed packs */}
        <div className="rounded border border-terminal-border bg-terminal-surface/60 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-terminal-border flex items-center justify-between">
            <span className="text-xs font-bold text-terminal-green tracking-widest uppercase">Installed</span>
            <span className="text-[10px] text-terminal-dim">{packs.length}</span>
          </div>
          <div className="divide-y divide-terminal-border">
            {loading && <div className="px-4 py-3 text-xs text-terminal-dim italic">Loading…</div>}
            {!loading && packs.length === 0 && (
              <div className="px-4 py-3 text-xs text-terminal-dim italic">No content packs installed yet.</div>
            )}
            {packs.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-semibold truncate">{p.name}</span>
                    <span className="text-[9px] text-terminal-dim">v{p.version}</span>
                    {!p.enabled && <span className="text-[9px] px-1.5 py-0.5 rounded border border-terminal-dim/40 text-terminal-dim uppercase tracking-widest">disabled</span>}
                  </div>
                  <div className="text-[10px] text-terminal-dim mt-0.5 truncate">
                    by {p.author} · {p.scenarioCount} scenario(s) · {p.characterCount} character(s)
                  </div>
                </div>
                <button
                  onClick={() => toggle(p)}
                  disabled={busy}
                  className="text-[10px] px-2 py-1 rounded border border-terminal-border text-terminal-dim
                    hover:text-white hover:border-terminal-dim disabled:opacity-40 transition-all"
                >
                  {p.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => uninstall(p)}
                  disabled={busy}
                  className="text-[10px] px-2 py-1 rounded border border-terminal-red/30 text-terminal-red/80
                    hover:border-terminal-red hover:text-terminal-red disabled:opacity-40 transition-all"
                >
                  Uninstall
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Export / create a pack */}
        <div className="rounded border border-terminal-border bg-terminal-surface/60 overflow-hidden">
          <button
            onClick={() => setShowExport((v) => !v)}
            className="w-full px-4 py-2.5 border-b border-terminal-border flex items-center justify-between group"
          >
            <span className="text-xs font-bold text-terminal-blue tracking-widest uppercase">Create a Pack</span>
            <span className="text-[9px] text-terminal-dim/40 group-hover:text-terminal-dim transition-colors">{showExport ? '▲' : '▼'}</span>
          </button>

          {showExport && (
            <div className="p-4 space-y-4">
              <p className="text-[11px] text-terminal-dim leading-relaxed">
                Bundle your custom scenarios and roster characters into a <code>.dicepack</code> file to share. The file is
                validated before download, so it's guaranteed to import cleanly elsewhere.
              </p>

              {/* Manifest */}
              <div className="grid grid-cols-2 gap-2">
                <label className="col-span-2 text-[10px] text-terminal-dim uppercase tracking-widest">Pack ID (unique, e.g. com.yourname.ot-threats)</label>
                <input value={exId} onChange={(e) => setExId(e.target.value)} placeholder="com.yourname.my-pack"
                  className="col-span-2 bg-terminal-bg border border-terminal-border focus:border-terminal-blue text-white text-sm px-3 py-2 rounded focus:outline-none placeholder-terminal-dim/50" />
                <input value={exName} onChange={(e) => setExName(e.target.value)} placeholder="Pack name"
                  className="bg-terminal-bg border border-terminal-border focus:border-terminal-blue text-white text-sm px-3 py-2 rounded focus:outline-none placeholder-terminal-dim/50" />
                <input value={exVer} onChange={(e) => setExVer(e.target.value)} placeholder="1.0.0"
                  className="bg-terminal-bg border border-terminal-border focus:border-terminal-blue text-white text-sm px-3 py-2 rounded focus:outline-none placeholder-terminal-dim/50" />
                <input value={exAuthor} onChange={(e) => setExAuthor(e.target.value)} placeholder="Author"
                  className="col-span-2 bg-terminal-bg border border-terminal-border focus:border-terminal-blue text-white text-sm px-3 py-2 rounded focus:outline-none placeholder-terminal-dim/50" />
                <input value={exDesc} onChange={(e) => setExDesc(e.target.value)} placeholder="Description (optional)"
                  className="col-span-2 bg-terminal-bg border border-terminal-border focus:border-terminal-blue text-white text-sm px-3 py-2 rounded focus:outline-none placeholder-terminal-dim/50" />
              </div>

              {/* Pickers */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-terminal-dim uppercase tracking-widest mb-1.5">Scenarios ({exScenarios.size})</div>
                  <div className="rounded border border-terminal-border max-h-40 overflow-y-auto divide-y divide-terminal-border">
                    {customScenarios.length === 0 && <div className="px-2 py-2 text-[10px] text-terminal-dim italic">No custom scenarios yet.</div>}
                    {customScenarios.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-gray-300 cursor-pointer hover:bg-terminal-bg/40">
                        <input type="checkbox" checked={exScenarios.has(s.id)} onChange={() => setExScenarios((p) => toggleIn(p, s.id))} />
                        <span className="truncate">{s.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-terminal-dim uppercase tracking-widest mb-1.5">Characters ({exChars.size})</div>
                  <div className="rounded border border-terminal-border max-h-40 overflow-y-auto divide-y divide-terminal-border">
                    {roster.length === 0 && <div className="px-2 py-2 text-[10px] text-terminal-dim italic">No roster characters yet.</div>}
                    {roster.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-gray-300 cursor-pointer hover:bg-terminal-bg/40">
                        <input type="checkbox" checked={exChars.has(c.id)} onChange={() => setExChars((p) => toggleIn(p, c.id))} />
                        <span className="truncate">{c.name} <span className="text-terminal-dim">· {c.class}</span></span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {exMsg && (
                <div className={`rounded border p-3 text-[11px] leading-relaxed ${exMsg.kind === 'success'
                  ? 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green'
                  : 'border-terminal-red/40 bg-terminal-red/10 text-terminal-red'}`}>
                  {exMsg.lines.map((l, i) => <div key={i} className={i === 0 ? 'font-bold' : 'opacity-80'}>{l}</div>)}
                </div>
              )}

              <button
                onClick={doExport}
                className="w-full py-2.5 rounded border border-terminal-blue bg-terminal-blue/10 text-terminal-blue
                  font-bold text-sm tracking-widest uppercase hover:bg-terminal-blue/20 transition-all"
              >
                ↧ Export .dicepack
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
