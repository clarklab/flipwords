import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import FlipWords from '@/components/FlipWords'
import Scorecard from '@/components/Scorecard'
import { getSessionForDate } from '@/daily/schedule'
import { easternDateString, dayNumber } from '@/daily/date'
import { loadStorage, saveStorage } from '@/daily/storage'
import { recordCompletion } from '@/daily/streak'
import { shareSession } from '@/daily/share'
import type { SessionResult, StoredSession } from '@/daily/types'

export const Route = createFileRoute('/play')({
  component: PlayRoute,
})

function PlayRoute() {
  const navigate = useNavigate()

  // Snapshot the start date so a cross-midnight session still resolves to its
  // original day (per the design spec edge case).
  const [startDate] = useState(() => easternDateString())
  const session = useMemo(() => getSessionForDate(startDate), [startDate])
  const dn = dayNumber(startDate)

  const initial = loadStorage()
  const [existingResult, setExistingResult] = useState<StoredSession | null>(
    initial.sessions[startDate] ?? null
  )
  const [practiceMode, setPracticeMode] = useState(false)

  const handleComplete = (result: SessionResult) => {
    const next = recordCompletion(loadStorage(), startDate, result)
    saveStorage(next)
    setExistingResult(next.sessions[startDate] ?? null)
  }

  const handlePractice = () => {
    setPracticeMode(true)
  }

  // Practice run: replay the same session; onComplete is a no-op.
  if (practiceMode) {
    return (
      <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
        <FlipWords
          key={`practice-${startDate}`}
          session={session}
          date={startDate}
          dayNumber={dn}
          mode="practice"
          scorecardPrimaryLabel="Back to title"
          scorecardPrimaryIcon="home"
          onScorecardPrimary={() => navigate({ to: '/' })}
        />
      </div>
    )
  }

  // Already-done branch: show the stored scorecard with practice + archive options.
  if (existingResult) {
    return (
      <ScorecardLock
        result={existingResult}
        dayNumber={dn}
        onPractice={handlePractice}
        onArchive={() => navigate({ to: '/archive' as never })}
      />
    )
  }

  // First run of today.
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
      <FlipWords
        session={session}
        date={startDate}
        dayNumber={dn}
        mode="daily"
        scorecardPrimaryLabel="Share result"
        scorecardPrimaryIcon="ios_share"
        onScorecardPrimary={() => {
          // Read fresh from storage — existingResult state may not have updated
          // yet on the very first React re-render after onComplete fires.
          const stored = loadStorage().sessions[startDate]
          if (!stored) return
          shareSession({
            dayNumber: dn,
            stars: stored.stars,
            totalDurationMs: stored.totalDurationMs,
          })
        }}
        onComplete={handleComplete}
      />
    </div>
  )
}

function ScorecardLock({
  result,
  dayNumber: dn,
  onPractice,
  onArchive,
}: {
  result: StoredSession
  dayNumber: number
  onPractice: () => void
  onArchive: () => void
}) {
  const totalStars = result.perPuzzle.reduce((s, p) => s + p.stars, 0)
  const possible = result.perPuzzle.length * 3
  const overall: 1 | 2 | 3 =
    totalStars === possible ? 3 : totalStars >= possible * (2 / 3) ? 2 : 1
  const totalGuesses = result.perPuzzle.reduce((s, p) => s + p.attempts, 0)
  const totalHints = result.perPuzzle.reduce((s, p) => s + p.hints, 0)

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
      <Scorecard
        open
        headline="Today's session"
        overallStars={overall}
        totalStars={totalStars}
        possibleStars={possible}
        sessionDurationMs={result.totalDurationMs}
        totalGuesses={totalGuesses}
        totalHints={totalHints}
        perPuzzle={result.perPuzzle}
        primaryLabel="Share result"
        primaryIcon="ios_share"
        onPrimary={() =>
          shareSession({
            dayNumber: dn,
            stars: result.stars,
            totalDurationMs: result.totalDurationMs,
          })
        }
      />
      <div className="fixed bottom-6 inset-x-0 z-[60] flex flex-col items-center gap-2 px-6 pointer-events-none">
        <button
          onClick={onPractice}
          className="pointer-events-auto font-ui flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink py-2 px-3"
        >
          <span className="material-icons text-[18px] text-ink-soft">refresh</span>
          Play again (practice — won't change score)
        </button>
        <button
          onClick={onArchive}
          className="pointer-events-auto font-ui flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink py-1 px-3"
        >
          <span className="material-icons text-[18px] text-ink-soft">history</span>
          Browse archive
        </button>
      </div>
    </div>
  )
}
