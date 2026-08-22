import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { useCampaignStore } from '../store/campaignStore'
import { useUserStore } from '../store/userStore'
import { buildCampaignCertificate } from '../utils/campaignCertificate'
import { downloadCampaignCertificate } from '../utils/certificateImage'
import type { Campaign } from '../types/campaign'

// Downloads the PNG completion certificate for a finished campaign.
//
// Shared by SessionEnd (dark, at the moment of completion) and Analytics
// (light, for reprints later) because the gathering of state — recipient,
// scenario catalog, session history, roster — is identical in both and only
// the palette differs.

type Variant = 'dark' | 'light'

const STYLES: Record<Variant, { button: string; error: string }> = {
  dark: {
    button: 'px-4 py-2 rounded border border-terminal-blue bg-terminal-blue/10 text-terminal-blue '
      + 'text-xs font-bold tracking-widest uppercase hover:bg-terminal-blue/20 transition-colors '
      + 'disabled:opacity-50 disabled:cursor-not-allowed',
    error:  'text-xs text-terminal-red mt-2',
  },
  light: {
    button: 'px-3 py-1.5 rounded border border-blue-300 bg-blue-50 text-blue-700 text-[11px] '
      + 'font-semibold tracking-wide uppercase hover:bg-blue-100 transition-colors '
      + 'disabled:opacity-50 disabled:cursor-not-allowed',
    error:  'text-[11px] text-red-600 mt-2',
  },
}

export function CampaignCertificateButton({
  campaign,
  variant = 'dark',
  label = '⬇ Download Certificate',
}: {
  campaign: Campaign
  variant?: Variant
  label?:   string
}) {
  const user            = useUserStore((s) => s.user)
  const customScenarios = useCampaignStore((s) => s.customScenarios)
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recipientName = user?.displayName?.trim() || user?.username?.trim() || ''
  const styles = STYLES[variant]

  const handleDownload = async () => {
    setBusy(true)
    setError(null)
    try {
      // Read history and roster at click time rather than subscribing: this
      // button sits inside pages that re-render on every session event, and
      // neither collection affects what it looks like.
      const { sessionHistory, roster } = useGameStore.getState()
      const cert = buildCampaignCertificate(
        campaign, recipientName, customScenarios, sessionHistory, roster,
      )
      if (!cert) {
        setError('This campaign has scenarios with no recorded result, so it cannot be certified.')
        return
      }
      await downloadCampaignCertificate(cert)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the certificate.')
    } finally {
      setBusy(false)
    }
  }

  // Nothing to put on the "this certifies that" line — better to say so than to
  // issue a certificate made out to nobody.
  if (!recipientName) return null

  return (
    <div>
      <button onClick={handleDownload} disabled={busy} className={styles.button}>
        {busy ? 'Generating…' : label}
      </button>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}
