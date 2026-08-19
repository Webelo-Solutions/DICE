import { useMemo, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { api } from '../api/client'
import { useToastStore } from '../store/toastStore'
import { EmptyState } from '../components/EmptyState'
import { buildCpeLedger } from '../utils/cpe'
import { formatTimestamp } from '../utils/learningPath'

const fmtCredits = (n: number) => n.toFixed(1)

// Start of the current calendar year, for the year-to-date column. ISC² tracks
// against a three-year certification cycle whose start date is per-member and
// not something DICE knows, so the ledger reports the calendar year — a figure
// that is unambiguous — and leaves cycle arithmetic to the member.
const startOfYear = () => new Date(new Date().getFullYear(), 0, 1).getTime()

// Everyone's CPE credit across every departmental session in this account's
// history, with the per-session detail behind each total and a certificate for
// each one. The "manage" half of CPE: the hot wash covers one session, this
// covers a person.
export function CpeLedger() {
  const sessionHistory = useGameStore((s) => s.sessionHistory)
  const pushToast = useToastStore((s) => s.push)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const ledger = useMemo(() => buildCpeLedger(sessionHistory, startOfYear()), [sessionHistory])

  const totals = useMemo(() => ({
    people:   ledger.length,
    credits:  Math.round(ledger.reduce((sum, e) => sum + e.totalCredits, 0) * 100) / 100,
    thisYear: Math.round(ledger.reduce((sum, e) => sum + e.creditsThisYear, 0) * 100) / 100,
  }), [ledger])

  const download = async (sessionId: string, participantId: string) => {
    const key = `${sessionId}:${participantId}`
    setBusyId(key)
    try {
      await api.downloadCpeCertificate(sessionId, participantId)
    } catch (e) {
      pushToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-terminal-bg font-mono p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-terminal-green tracking-widest uppercase">CPE Credit</h1>
          <p className="text-xs text-terminal-dim mt-1">
            ISC² continuing professional education earned in departmental exercises you facilitated.
            Credit is measured from each person's connected time, at one CPE per hour, rounded down to
            the half credit.
          </p>
        </div>

        {ledger.length === 0 ? (
          <EmptyState
            message="No CPE credit recorded yet."
            action={
              <span className="text-xs text-terminal-dim">
                Credit is earned in departmental rooms — a standard or solo session names characters
                rather than people, so there is no attendee to certify.
              </span>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'People',          value: String(totals.people) },
                { label: 'Credits To Date', value: fmtCredits(totals.credits) },
                { label: 'This Year',       value: fmtCredits(totals.thisYear) },
              ].map((s) => (
                <div key={s.label} className="border border-terminal-border bg-terminal-surface rounded p-3 text-center">
                  <div className="text-2xl font-bold text-white tabular-nums">{s.value}</div>
                  <div className="text-[10px] text-terminal-dim uppercase tracking-widest mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="border border-terminal-border rounded overflow-hidden">
              {ledger.map((entry) => {
                const open = openKey === entry.key
                return (
                  <div key={entry.key} className="border-b border-terminal-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpenKey(open ? null : entry.key)}
                      aria-expanded={open}
                      className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-terminal-surface transition-colors"
                    >
                      <span className="text-terminal-dim text-xs w-3 flex-shrink-0">{open ? '▾' : '▸'}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-white truncate">{entry.attendeeName}</span>
                        <span className="block text-[10px] text-terminal-dim mt-0.5">
                          {entry.sessionsAttended} session{entry.sessionsAttended === 1 ? '' : 's'} ·{' '}
                          {entry.totalMinutes} min attended · last {formatTimestamp(entry.lastAttendedAt).split(',')[0]}
                        </span>
                      </span>
                      <span className="text-right flex-shrink-0">
                        <span className="block text-lg font-bold text-terminal-green tabular-nums">{fmtCredits(entry.totalCredits)}</span>
                        <span className="block text-[10px] text-terminal-dim uppercase tracking-widest">total</span>
                      </span>
                      <span className="text-right flex-shrink-0 w-16">
                        <span className="block text-sm font-bold text-white tabular-nums">{fmtCredits(entry.creditsThisYear)}</span>
                        <span className="block text-[10px] text-terminal-dim uppercase tracking-widest">this yr</span>
                      </span>
                    </button>

                    {open && (
                      <div className="px-4 pb-3 pl-11 space-y-1.5">
                        {entry.sessions.map((s) => {
                          const key = `${s.sessionId}:${s.participantId}`
                          return (
                            <div key={key} className="flex items-center gap-3 text-xs border border-terminal-border rounded px-3 py-2">
                              <span className="flex-1 min-w-0">
                                <span className="block text-white truncate">{s.activityTitle}</span>
                                <span className="block text-[10px] text-terminal-dim">
                                  {formatTimestamp(s.activityDate)} · {s.attendedMinutes} min · Group {s.group}
                                </span>
                              </span>
                              <span className="text-terminal-green font-bold tabular-nums flex-shrink-0">{fmtCredits(s.credits)}</span>
                              <button
                                onClick={() => download(s.sessionId, s.participantId)}
                                disabled={busyId === key}
                                title="Download certificate of attendance (PDF)"
                                className="text-[10px] px-2 py-1 rounded border border-terminal-border text-terminal-dim
                                  hover:text-white hover:border-terminal-dim disabled:opacity-40 transition-all flex-shrink-0"
                              >
                                {busyId === key ? '…' : 'PDF'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-[11px] text-terminal-dim/70 leading-relaxed">
              Totals are per calendar year. ISC² measures against a three-year certification cycle whose
              start date differs per member, so the cycle total is not shown here — take the year figures
              and count back over your own cycle. Each attendee is responsible for confirming the activity
              qualifies under their credential's CPE policy before submitting.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
