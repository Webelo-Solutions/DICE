import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { useRoomStore } from '../store/roomStore'
import { useGameStore } from '../store/gameStore'
import { connectRoom, disconnectRoom } from '../api/roomSocket'
import { roomApi } from '../api/rooms'
import { ProviderSettingsModal } from '../components/ProviderSettingsModal'
import { ClaimFacilitatorPanel } from '../components/ClaimFacilitatorPanel'

export function Lobby() {
  const navigate = useNavigate()
  const membership   = useRoomStore((s) => s.membership)
  const participants = useRoomStore((s) => s.participants)
  const connected    = useRoomStore((s) => s.connected)
  const providerConfig = useGameStore((s) => s.providerConfig)
  const hasProvider = !!providerConfig?.apiKey
  const [providerOpen, setProviderOpen] = useState(false)
  const [port, setPort] = useState<number | null>(null)
  const [addresses, setAddresses] = useState<string[]>([])
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [watchQrDataUrl, setWatchQrDataUrl] = useState<string | null>(null)

  // No membership (e.g. direct navigation or after leaving) → back to home.
  useEffect(() => {
    if (!membership) { navigate('/'); return }
    connectRoom(membership.code, membership.token)
    // Keep the connection alive across the session; disconnect only on Leave.
  }, [membership?.code])

  // Facilitator only: resolve the host's LAN address(es) so players can scan a QR
  // instead of the facilitator reading an IP off `ipconfig` and reciting it. A
  // host machine often reports more than one candidate (real LAN NIC alongside
  // VPN/WSL/hypervisor virtual adapters) with no reliable "the right one" order,
  // so default to the first but let the facilitator switch if it's wrong.
  useEffect(() => {
    if (!membership || membership.role !== 'facilitator') return
    let cancelled = false
    roomApi.getNetworkInfo().then(({ port, addresses }) => {
      if (cancelled) return
      setPort(port); setAddresses(addresses)
      setSelectedAddress(addresses[0] ?? null)
    }).catch(() => { /* no LAN-facing address available — fall back to the code-only view */ })
    return () => { cancelled = true }
  }, [membership?.code, membership?.role])

  const joinUrl = selectedAddress && port && membership
    ? `http://${selectedAddress}:${port}/join?code=${membership.code}`
    : null
  const watchUrl = selectedAddress && port && membership
    ? `http://${selectedAddress}:${port}/watch/${membership.code}`
    : null

  useEffect(() => {
    if (!joinUrl) { setQrDataUrl(null); return }
    let cancelled = false
    QRCode.toDataURL(joinUrl, { margin: 1, width: 176 }).then((dataUrl) => { if (!cancelled) setQrDataUrl(dataUrl) })
    return () => { cancelled = true }
  }, [joinUrl])

  useEffect(() => {
    if (!watchUrl) { setWatchQrDataUrl(null); return }
    let cancelled = false
    QRCode.toDataURL(watchUrl, { margin: 1, width: 176 }).then((dataUrl) => { if (!cancelled) setWatchQrDataUrl(dataUrl) })
    return () => { cancelled = true }
  }, [watchUrl])

  if (!membership) return null

  const leave = () => { disconnectRoom(); useRoomStore.getState().clearMembership(); navigate('/') }
  const isFacilitator = membership.role === 'facilitator'

  return (
    <div className="min-h-screen bg-terminal-bg font-mono flex flex-col items-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase">Lobby</div>
            <h1 className="text-xl font-bold text-white">{membership.roomName}</h1>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded border ${connected
            ? 'border-terminal-green/40 bg-terminal-green/10 text-terminal-green'
            : 'border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber'}`}>
            {connected ? '● live' : '○ connecting…'}
          </span>
        </div>

        {/* Shareable room code */}
        <div className="rounded border border-terminal-green/30 bg-terminal-green/5 p-5 text-center">
          <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-2">Room Code — share to invite players</div>
          <div className="text-4xl font-bold text-terminal-green tracking-[0.4em] select-all">{membership.code}</div>
          <div className="text-[10px] text-terminal-dim/70 mt-3">Players on this local network join with this code · trusted networks only</div>

          {isFacilitator && qrDataUrl && joinUrl && (
            <div className="mt-4 pt-4 border-t border-terminal-green/20 flex flex-col items-center gap-2">
              <img src={qrDataUrl} alt="Scan to join" width={110} height={110} className="rounded bg-white p-1.5" />
              <div className="text-[10px] text-terminal-dim/70">Scan, or open</div>
              <div className="text-xs text-terminal-green select-all break-all">{joinUrl}</div>
              {addresses.length > 1 && (
                <label className="text-[10px] text-terminal-dim/70 flex items-center gap-1.5 mt-1">
                  Wrong network?
                  <select value={selectedAddress ?? ''} onChange={(e) => setSelectedAddress(e.target.value)}
                    className="bg-terminal-surface border border-terminal-border rounded px-1.5 py-0.5 text-terminal-green">
                    {addresses.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Participant list (live via WebSocket) */}
        <div className="rounded border border-terminal-border bg-terminal-surface/60 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-terminal-border flex items-center justify-between">
            <span className="text-xs font-bold text-terminal-green tracking-widest uppercase">Participants</span>
            <span className="text-[10px] text-terminal-dim">{participants.length}</span>
          </div>
          <div className="divide-y divide-terminal-border">
            {participants.length === 0 && <div className="px-4 py-3 text-xs text-terminal-dim italic">Waiting for participants…</div>}
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.connected ? 'bg-terminal-green' : 'bg-terminal-dim/40'}`}
                  title={p.connected ? 'Connected' : 'Offline'}
                />
                <span className={`text-[9px] px-1.5 py-0.5 rounded border tracking-widest uppercase ${p.role === 'facilitator'
                  ? 'border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber'
                  : 'border-terminal-blue/40 bg-terminal-blue/10 text-terminal-blue'}`}>
                  {p.role}
                </span>
                <span className="text-sm text-white flex-1 truncate">{p.displayName}</span>
                {p.id === membership.participantId && <span className="text-[10px] text-terminal-dim">you</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Spectator / audience view — facilitator only, no login required to view */}
        {isFacilitator && watchQrDataUrl && watchUrl && (
          <div className="rounded border border-terminal-blue/30 bg-terminal-blue/5 p-5 text-center">
            <div className="text-[10px] text-terminal-dim tracking-widest uppercase mb-2">
              Spectator / Audience View — no login required
            </div>
            <div className="flex flex-col items-center gap-2">
              <img src={watchQrDataUrl} alt="Scan to watch" width={110} height={110} className="rounded bg-white p-1.5" />
              <div className="text-[10px] text-terminal-dim/70">Scan, or open</div>
              <div className="text-xs text-terminal-blue select-all break-all">{watchUrl}</div>
            </div>
          </div>
        )}

        {/* Phase note + actions */}
        <div className="rounded border border-terminal-border bg-terminal-surface/40 px-4 py-3 text-[11px] text-terminal-dim leading-relaxed">
          {isFacilitator
            ? 'You are the facilitator. Pick a scenario and run the session as usual — every participant sees the incident unfold live.'
            : 'Waiting for the facilitator to start the session. You will join the shared incident automatically.'}
        </div>

        <ClaimFacilitatorPanel />

        {isFacilitator && !hasProvider && (
          <button onClick={() => setProviderOpen(true)}
            className="w-full py-3 rounded border border-terminal-amber/50 bg-terminal-amber/10 text-terminal-amber
              font-bold text-sm tracking-widest uppercase hover:bg-terminal-amber/20 transition-all">
            ⚙ Configure AI Provider First
          </button>
        )}

        {isFacilitator && (
          <button onClick={() => navigate('/scenarios')} disabled={!hasProvider}
            title={hasProvider ? '' : 'Set your AI provider key before starting'}
            className="w-full py-3 rounded border border-terminal-green bg-terminal-green/10 text-terminal-green
              font-bold text-sm tracking-widest uppercase hover:bg-terminal-green/20
              disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            ▶ Start Session
          </button>
        )}

        {providerOpen && <ProviderSettingsModal onClose={() => setProviderOpen(false)} />}

        <button onClick={leave}
          className="w-full py-2.5 rounded border border-terminal-red/30 text-terminal-red/80 text-xs font-semibold
            tracking-widest uppercase hover:border-terminal-red hover:text-terminal-red transition-all">
          Leave Room
        </button>
      </div>
    </div>
  )
}
