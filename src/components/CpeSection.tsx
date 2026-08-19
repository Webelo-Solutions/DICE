import { useState } from 'react'
import { api } from '../api/client'
import { useToastStore } from '../store/toastStore'
import type { SessionCpeReport } from '../types/cpe'

const fmtCredits = (n: number) => n.toFixed(1)

// The CPE half of the after-action report: what each person is entitled to
// claim, and the attendance behind it. Sits in HotWash, which is a light,
// print-oriented document, so this follows that treatment rather than the
// terminal styling used during play.
export function CpeSection({ sessionId, report }: { sessionId: string; report: SessionCpeReport }) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const pushToast = useToastStore((s) => s.push)

  const earned = report.awards.filter((a) => a.credits > 0)
  const totalCredits = earned.reduce((sum, a) => sum + a.credits, 0)

  const download = async (participantId: string) => {
    setBusyId(participantId)
    try {
      await api.downloadCpeCertificate(sessionId, participantId)
    } catch (e) {
      pushToast(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Attendees Credited', value: String(earned.length) },
          { label: 'Credits Issued',     value: fmtCredits(totalCredits) },
          { label: 'Session Length',     value: `${report.sessionMinutes} min` },
          { label: 'ISC² Group',         value: report.rules.group },
        ].map((s) => (
          <div key={s.label} className="border border-gray-200 rounded p-3 text-center">
            <div className="text-2xl font-bold text-gray-900 tabular-nums">{s.value}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[620px]">
          <thead>
            <tr className="bg-gray-50 text-gray-600">
              <th className="text-left  font-semibold px-2 py-1.5 border-b border-gray-200">Attendee</th>
              <th className="text-left  font-semibold px-2 py-1.5 border-b border-gray-200">Role</th>
              <th className="text-right font-semibold px-2 py-1.5 border-b border-gray-200">Attended</th>
              <th className="text-right font-semibold px-2 py-1.5 border-b border-gray-200">Connections</th>
              <th className="text-right font-semibold px-2 py-1.5 border-b border-gray-200">CPE</th>
              <th className="text-right font-semibold px-2 py-1.5 border-b border-gray-200">Certificate</th>
            </tr>
          </thead>
          <tbody>
            {report.awards.map((a) => (
              <tr key={a.participantId} className={a.credits > 0 ? '' : 'text-gray-400'}>
                <td className="px-2 py-1.5 border-b border-gray-100 font-medium text-gray-900">
                  {a.attendeeName}
                  {a.departmentName && <span className="text-gray-400 font-normal"> · {a.departmentName}</span>}
                </td>
                <td className="px-2 py-1.5 border-b border-gray-100">{a.gameRole ?? '—'}</td>
                <td className="px-2 py-1.5 border-b border-gray-100 text-right tabular-nums">{a.attendedMinutes} min</td>
                <td className="px-2 py-1.5 border-b border-gray-100 text-right tabular-nums">
                  {a.spans}
                  {a.disconnects > 0 && <span className="text-amber-700"> ({a.disconnects} drop{a.disconnects === 1 ? '' : 's'})</span>}
                </td>
                <td className="px-2 py-1.5 border-b border-gray-100 text-right tabular-nums font-bold text-gray-900">
                  {fmtCredits(a.credits)}
                </td>
                <td className="px-2 py-1.5 border-b border-gray-100 text-right">
                  {a.credits > 0 ? (
                    <button
                      onClick={() => download(a.participantId)}
                      disabled={busyId === a.participantId}
                      className="print:hidden text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500
                        hover:border-gray-400 hover:text-gray-800 disabled:opacity-40 transition-all"
                    >
                      {busyId === a.participantId ? '…' : 'PDF'}
                    </button>
                  ) : (
                    <span className="text-[10px] text-gray-400">under 30 min</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The arithmetic, stated where the numbers are. Anyone asked to accept a
          credit will want to know what it was derived from. */}
      <p className="text-[11px] text-gray-500 leading-relaxed">
        One CPE per {report.rules.minutesPerCredit} minutes of measured attendance, in{' '}
        {report.rules.creditIncrement}-credit steps, rounded down — so under 30 minutes earns nothing.
        Attendance is each person's connected time during the exercise, not the session's length, which is
        why someone who dropped out partway earns less than the person beside them. Confirm the activity
        qualifies under the CPE policy of the credential being maintained before submitting to ISC².
      </p>
    </div>
  )
}
