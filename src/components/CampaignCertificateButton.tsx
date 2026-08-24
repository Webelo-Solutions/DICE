import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { useCampaignStore } from '../store/campaignStore'
import { useUserStore } from '../store/userStore'
import { api } from '../api/client'
import { buildCampaignCertificate } from '../utils/campaignCertificate'
import { downloadCampaignCertificate } from '../utils/certificateImage'
import type { Campaign } from '../types/campaign'

// Downloads a completion certificate for a finished campaign, in either of
// two formats built from the same underlying data:
//   PNG — the detailed record: every scenario, its difficulty, and the hours
//         behind it. Rendered entirely client-side (certificateImage.ts), so
//         it works even with the server unreachable.
//   PDF — the executive summary, sharing the CPE certificate's visual design
//         (server/reports/certificateChrome.ts). Requires the server, since
//         pdfkit can't run in a browser.
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
}: {
  campaign: Campaign
  variant?: Variant
}) {
  const user            = useUserStore((s) => s.user)
  const customScenarios = useCampaignStore((s) => s.customScenarios)
  const [busy,  setBusy]  = useState<'png' | 'pdf' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const recipientName = user?.displayName?.trim() || user?.username?.trim() || ''
  const styles = STYLES[variant]

  // Both formats start from the same computed certificate — the PNG path
  // draws it directly, the PDF path sends the same summary fields to the
  // server instead of the scenario-by-scenario detail, since that table is
  // what the PNG is for.
  const buildCert = () => {
    const { sessionHistory, roster } = useGameStore.getState()
    return buildCampaignCertificate(campaign, recipientName, customScenarios, sessionHistory, roster)
  }

  const handleDownload = async (format: 'png' | 'pdf') => {
    setBusy(format)
    setError(null)
    try {
      const cert = buildCert()
      if (!cert) {
        setError('This campaign has scenarios with no recorded result, so it cannot be certified.')
        return
      }
      if (format === 'png') {
        await downloadCampaignCertificate(cert)
      } else {
        await api.downloadCampaignCertificatePdf({
          recipientName:  cert.recipientName,
          campaignName:   cert.campaignName,
          startedAt:      cert.startedAt,
          completedAt:    cert.completedAt,
          scenarioCount:  cert.scenarios.length,
          totalHours:     cert.totalHours,
          outcomeCounts:  cert.outcomeCounts,
          certificateId:  cert.certificateId,
        })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate the certificate.')
    } finally {
      setBusy(null)
    }
  }

  // Nothing to put on the "this certifies that" line — better to say so than to
  // issue a certificate made out to nobody.
  if (!recipientName) return null

  return (
    <div>
      <div className="flex gap-2">
        <button onClick={() => handleDownload('png')} disabled={busy !== null} className={styles.button}>
          {busy === 'png' ? 'Generating…' : '⬇ PNG'}
        </button>
        <button onClick={() => handleDownload('pdf')} disabled={busy !== null} className={styles.button}>
          {busy === 'pdf' ? 'Generating…' : '⬇ PDF'}
        </button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  )
}
