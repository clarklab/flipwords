import { useEffect, useMemo } from 'react'
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import FlipWords from '@/components/FlipWords'
import { getSessionForDate } from '@/daily/schedule'
import { dayNumber, easternDateString } from '@/daily/date'
import { loadStorage, saveStorage } from '@/daily/storage'
import { recordCompletion } from '@/daily/streak'
import { readProgress, writeProgress } from '@/daily/progress'
import { useEdition } from '@/edition'
import type { PuzzleResult, SessionResult } from '@/daily/types'

export const Route = createFileRoute('/archive_/$date')({
  component: ArchiveReplay,
})

function ArchiveReplay() {
  const navigate = useNavigate()
  const { date } = useParams({ from: '/archive_/$date' })
  const { config } = useEdition()
  const today = easternDateString()

  // Today's puzzle belongs on /play where streaks and locking live.
  useEffect(() => {
    if (date === today) navigate({ to: '/play', replace: true })
  }, [date, today, navigate])

  // A missed day (no stored result) is a MAKEUP: it records a real result
  // that counts toward totals but never the streak. An already-played day
  // replays as practice — nothing is recorded.
  const alreadyPlayed = !!loadStorage(config).sessions[date]

  const resume = useMemo(() => {
    if (alreadyPlayed) return null
    const p = readProgress(loadStorage(config), date, 'makeup')
    return p ? { puzzlesDone: p.puzzlesDone, elapsedMs: p.elapsedMs } : null
  }, [config, date, alreadyPlayed])

  // Guardrails: refuse pre-launch and future dates.
  if (date < config.launchDate || date > today) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-paper p-6">
        <div className="text-center">
          <p className="font-wide text-2xl text-ink mb-3">No puzzle for that date.</p>
          <button
            onClick={() => navigate({ to: '/archive' })}
            className="btn-primary font-ui bg-ink text-surface r-btn px-5 py-2.5"
          >
            Back to archive
          </button>
        </div>
      </div>
    )
  }
  if (date === today) return null // redirecting

  const session = getSessionForDate(config, date)
  const dn = dayNumber(date, config.launchDate)

  const handleMakeupComplete = (result: SessionResult) => {
    saveStorage(config, recordCompletion(loadStorage(config), date, result, 'makeup'))
  }
  const handleMakeupProgress = (p: {
    puzzlesDone: PuzzleResult[]
    currentIdx: number
    elapsedMs: number
  }) => {
    saveStorage(config, writeProgress(loadStorage(config), date, 'makeup', p))
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
      <FlipWords
        key={`archive-${date}-${alreadyPlayed ? 'practice' : 'makeup'}`}
        session={session}
        mode="archive"
        date={date}
        dayNumber={dn}
        initialProgress={resume ?? undefined}
        onProgress={alreadyPlayed ? undefined : handleMakeupProgress}
        onComplete={alreadyPlayed ? undefined : handleMakeupComplete}
        scorecardPrimaryLabel="Back to archive"
        onScorecardPrimary={() => navigate({ to: '/archive' })}
        onBack={() => navigate({ to: '/archive' })}
      />
    </div>
  )
}
