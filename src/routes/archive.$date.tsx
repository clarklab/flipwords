import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import FlipWords from '@/components/FlipWords'
import { getSessionForDate } from '@/daily/schedule'
import { dayNumber, LAUNCH_DATE, easternDateString } from '@/daily/date'

export const Route = createFileRoute('/archive/$date')({
  component: ArchiveReplay,
})

function ArchiveReplay() {
  const navigate = useNavigate()
  const { date } = useParams({ from: '/archive/$date' })

  // Guardrails: refuse pre-launch and future dates.
  const today = easternDateString()
  if (date < LAUNCH_DATE || date > today) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-paper p-6">
        <div className="text-center">
          <p className="font-wide text-2xl text-ink mb-3">No puzzle for that date.</p>
          <button
            onClick={() => navigate({ to: '/archive' })}
            className="font-ui bg-ink text-surface rounded-full px-5 py-2.5"
          >
            Back to archive
          </button>
        </div>
      </div>
    )
  }

  const session = getSessionForDate(date)
  const dn = dayNumber(date)

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
      <FlipWords
        session={session}
        mode="archive"
        date={date}
        dayNumber={dn}
        scorecardPrimaryLabel="Back to archive"
        scorecardPrimaryIcon="history"
        onScorecardPrimary={() => navigate({ to: '/archive' })}
      />
    </div>
  )
}
