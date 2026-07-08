import { useEffect, useRef, useState } from 'react'
import { useVoiceStore } from '../store/voiceStore'

const SUPPORTED = typeof window !== 'undefined' && 'speechSynthesis' in window

export function VoiceDMButton() {
  const { enabled, voiceURI, rate, pitch, setEnabled, setVoiceURI, setRate, setPitch } =
    useVoiceStore()

  const [open,   setOpen]   = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  // Load available voices — fires on first call and again on voiceschanged
  useEffect(() => {
    if (!SUPPORTED) return
    const load = () => {
      const all = window.speechSynthesis.getVoices()
      setVoices(all.filter((v) => v.lang.startsWith('en')))
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  // Close popover on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const testVoice = () => {
    if (!SUPPORTED) return
    const utt   = new SpeechSynthesisUtterance(
      'DICE Dungeon Master online. Incident narration active.'
    )
    const voice = voiceURI
      ? window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceURI) ?? null
      : null
    if (voice) utt.voice = voice
    utt.rate  = rate
    utt.pitch = pitch
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utt)
  }

  if (!SUPPORTED) return null

  return (
    <div ref={panelRef} className="relative flex-shrink-0">

      {/* Toggle + settings caret */}
      <div className="flex items-center">
        <button
          onClick={() => setEnabled(!enabled)}
          title={enabled ? 'Voice DM active — click to mute' : 'Voice DM off — click to enable'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-l border text-[10px]
            font-semibold tracking-widest uppercase transition-all ${
            enabled
              ? 'border-terminal-green bg-terminal-green/15 text-terminal-green'
              : 'border-terminal-border text-terminal-dim/50 hover:border-terminal-dim hover:text-terminal-dim'
          }`}
        >
          <span className="text-xs">{enabled ? '🔊' : '🔇'}</span>
          <span>Voice</span>
          {enabled && (
            <span className="w-1.5 h-1.5 rounded-full bg-terminal-green animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setOpen((o) => !o)}
          title="Voice settings"
          className={`px-1.5 py-1 rounded-r border border-l-0 text-[10px] transition-all ${
            open
              ? 'border-terminal-green bg-terminal-green/15 text-terminal-green'
              : 'border-terminal-border text-terminal-dim/50 hover:text-terminal-dim hover:border-terminal-dim'
          }`}
        >
          ⚙
        </button>
      </div>

      {/* Settings popover */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-68 bg-terminal-surface
          border border-terminal-border rounded-lg shadow-2xl z-50 font-mono overflow-hidden"
          style={{ width: 272 }}
        >
          <div className="px-4 py-3 border-b border-terminal-border flex items-center justify-between">
            <div>
              <div className="text-[9px] text-terminal-dim tracking-widest uppercase">Voice DM</div>
              <div className="text-xs text-white font-semibold mt-0.5">Narrator Settings</div>
            </div>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`px-2.5 py-1 rounded border text-[10px] font-bold tracking-widest uppercase
                transition-all ${
                enabled
                  ? 'border-terminal-green bg-terminal-green/15 text-terminal-green'
                  : 'border-terminal-border text-terminal-dim hover:border-terminal-green/50'
              }`}
            >
              {enabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="px-4 py-3 space-y-4">

            {/* Voice selector */}
            <div>
              <div className="text-[9px] text-terminal-dim tracking-widest uppercase mb-1.5">
                Voice
              </div>
              {voices.length === 0 ? (
                <div className="text-[10px] text-terminal-dim/60 italic">
                  No voices available in this browser.
                </div>
              ) : (
                <select
                  value={voiceURI}
                  onChange={(e) => setVoiceURI(e.target.value)}
                  className="w-full text-[11px] bg-terminal-bg border border-terminal-border
                    text-white rounded px-2 py-1.5 focus:outline-none focus:border-terminal-green
                    appearance-none transition-colors"
                >
                  <option value="">Browser Default</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Rate */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] text-terminal-dim tracking-widest uppercase">Speed</span>
                <span className="text-[10px] text-white font-mono">{rate.toFixed(2)}×</span>
              </div>
              <input
                type="range" min="0.6" max="1.4" step="0.05"
                value={rate}
                onChange={(e) => setRate(parseFloat(e.target.value))}
                className="w-full h-1.5 accent-terminal-green cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-terminal-dim/50 mt-0.5">
                <span>Slow</span><span>Fast</span>
              </div>
            </div>

            {/* Pitch */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] text-terminal-dim tracking-widest uppercase">Pitch</span>
                <span className="text-[10px] text-white font-mono">{pitch.toFixed(2)}</span>
              </div>
              <input
                type="range" min="0.6" max="1.2" step="0.05"
                value={pitch}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full h-1.5 accent-terminal-green cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-terminal-dim/50 mt-0.5">
                <span>Low</span><span>High</span>
              </div>
            </div>

            {/* Test button */}
            <button
              onClick={testVoice}
              className="w-full py-2 rounded border border-terminal-green/30 bg-terminal-green/5
                text-terminal-green text-[10px] font-semibold tracking-widest uppercase
                hover:bg-terminal-green/15 hover:border-terminal-green/60 transition-all"
            >
              ▶ Test Voice
            </button>

            <p className="text-[9px] text-terminal-dim/50 leading-relaxed">
              The DM speaks each sentence as it streams. Voice runs locally in your browser —
              no audio is sent to any server.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
