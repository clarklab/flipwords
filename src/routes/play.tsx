import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import FlipWords from '@/components/FlipWords'
import Scorecard from '@/components/Scorecard'
import { getSessionForDate } from '@/daily/schedule'
import { easternDateString, dayNumber } from '@/daily/date'
import { loadStorage, saveStorage } from '@/daily/storage'
import { recordCompletion } from '@/daily/streak'
import { readProgress, writeProgress } from '@/daily/progress'
import { useEasternDate } from '@/daily/useEasternDate'
import { formatShareString, shareSession } from '@/daily/share'
import type { PuzzleResult, SessionResult, StoredSession } from '@/daily/types'

export const Route = createFileRoute('/play')({
  component: PlayRoute,
  validateSearch: (search: Record<string, unknown>): { tutorial?: boolean } => ({
    tutorial:
      search.tutorial === true ||
      search.tutorial === 'true' ||
      search.tutorial === '1',
  }),
})

function ShareFallback({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-6"
      style={{ background: 'rgba(20,15,5,0.55)', backdropFilter: 'blur(6px)' }}
    >
      <div className="bg-tile-face rounded-3xl w-full max-w-sm p-5 shadow-tile-lift">
        <p className="font-ui text-[11px] text-ink-soft uppercase tracking-[0.22em] mb-3">
          Copy this manually
        </p>
        <textarea
          readOnly
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          className="w-full font-mono text-[13px] text-ink bg-surface border border-tile-edge rounded-2xl p-3 mb-4 resize-none"
          rows={4}
          value={text}
        />
        <button
          onClick={onClose}
          className="w-full font-ui bg-ink text-surface rounded-full py-3 text-sm"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function PlayRoute() {
  const navigate = useNavigate()
  const { tutorial: tutorialFromSearch } = Route.useSearch()

  // Snapshot the start date so a cross-midnight session still resolves to its
  // original day (per the design spec edge case). Resettable so the done-state
  // "new puzzle" CTA can roll the route onto the new day without a reload.
  const [startDate, setStartDate] = useState(() => easternDateString())
  const liveToday = useEasternDate()
  const session = useMemo(() => getSessionForDate(startDate), [startDate])
  const dn = dayNumber(startDate)

  const [existingResult, setExistingResult] = useState<StoredSession | null>(
    () => loadStorage().sessions[startDate] ?? null
  )
  const [practiceMode, setPracticeMode] = useState(false)
  const [shareFallbackText, setShareFallbackText] = useState<string | null>(null)

  // Resume seed: a valid inProgress record for this date restores finished
  // puzzles + the timer; the puzzle that was underway restarts fresh.
  const resume = useMemo(() => {
    const p = readProgress(loadStorage(), startDate, 'daily')
    return p ? { puzzlesDone: p.puzzlesDone, elapsedMs: p.elapsedMs } : null
  }, [startDate])

  const handleProgress = (p: {
    puzzlesDone: PuzzleResult[]
    currentIdx: number
    elapsedMs: number
  }) => {
    saveStorage(writeProgress(loadStorage(), startDate, 'daily', p))
  }

  const handleComplete = (result: SessionResult) => {
    // recordCompletion also clears the matching inProgress record.
    const next = recordCompletion(loadStorage(), startDate, result)
    saveStorage(next)
    setExistingResult(next.sessions[startDate] ?? null)
  }

  const handlePractice = () => {
    setPracticeMode(true)
  }

  const handlePlayToday = () => {
    const today = easternDateString()
    setPracticeMode(false)
    setStartDate(today)
    setExistingResult(loadStorage().sessions[today] ?? null)
  }

  const handleShare = async (input: {
    dayNumber: number
    perPuzzleStars: Array<1 | 2 | 3>
    totalDurationMs: number
    streak: number
  }) => {
    const result = await shareSession(input)
    if (result === 'failed') {
      setShareFallbackText(formatShareString(input))
    }
  }

  // Practice run: replay the same session; onComplete is a no-op.
  if (practiceMode) {
    return (
      <>
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
        {shareFallbackText && (
          <ShareFallback text={shareFallbackText} onClose={() => setShareFallbackText(null)} />
        )}
      </>
    )
  }

  // Already-done branch: show the stored scorecard with practice + archive options.
  if (existingResult) {
    return (
      <>
        <ScorecardLock
          result={existingResult}
          newDayAvailable={liveToday !== startDate}
          onPlayToday={handlePlayToday}
          onPractice={handlePractice}
          onArchive={() => navigate({ to: '/archive' })}
          onShare={() => {
            const stored = loadStorage()
            void handleShare({
              dayNumber: dn,
              perPuzzleStars: existingResult.perPuzzle.map((p) => p.stars),
              totalDurationMs: existingResult.totalDurationMs,
              streak: stored.streak.current,
            })
          }}
        />
        {shareFallbackText && (
          <ShareFallback text={shareFallbackText} onClose={() => setShareFallbackText(null)} />
        )}
      </>
    )
  }

  // First run of today.
  return (
    <>
      <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
        <FlipWords
          key={`daily-${startDate}`}
          session={session}
          date={startDate}
          dayNumber={dn}
          mode="daily"
          initialProgress={resume ?? undefined}
          onProgress={handleProgress}
          showTutorial={tutorialFromSearch}
          scorecardPrimaryLabel="Share result"
          scorecardPrimaryIcon="ios_share"
          onScorecardPrimary={() => {
            // Read fresh from storage — existingResult state may not have updated
            // yet on the very first React re-render after onComplete fires.
            const stored = loadStorage()
            const session = stored.sessions[startDate]
            if (!session) return
            void handleShare({
              dayNumber: dn,
              perPuzzleStars: session.perPuzzle.map((p) => p.stars),
              totalDurationMs: session.totalDurationMs,
              streak: stored.streak.current,
            })
          }}
          onComplete={handleComplete}
        />
      </div>
      {shareFallbackText && (
        <ShareFallback text={shareFallbackText} onClose={() => setShareFallbackText(null)} />
      )}
    </>
  )
}

function ScorecardLock({
  result,
  newDayAvailable,
  onPlayToday,
  onPractice,
  onArchive,
  onShare,
}: {
  result: StoredSession
  newDayAvailable: boolean
  onPlayToday: () => void
  onPractice: () => void
  onArchive: () => void
  onShare: () => void
}) {
  const totalStars = result.perPuzzle.reduce((s, p) => s + p.stars, 0)
  const possible = result.perPuzzle.length * 3
  const overall: 1 | 2 | 3 =
    totalStars === possible ? 3 : totalStars >= possible * (2 / 3) ? 2 : 1
  const totalGuesses = result.perPuzzle.reduce((s, p) => s + p.attempts, 0)
  const totalHints = result.perPuzzle.reduce((s, p) => s + p.hints, 0)

  const stored = loadStorage()
  const streakSnapshot = {
    current: stored.streak.current,
    best: stored.streak.best,
    deltaThisSession: false, // not just-earned — they completed earlier
  }

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
        onPrimary={onShare}
        streak={streakSnapshot}
      />
      <div
        className="fixed bottom-0 inset-x-0 z-[60] flex flex-col items-center gap-2 px-6 pointer-events-none"
        style={{ paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 0.5rem))' }}
      >
        {newDayAvailable && (
          <button
            onClick={onPlayToday}
            className="pointer-events-auto font-ui flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-full text-sm shadow-tile-lift active:scale-95"
          >
            <span className="material-icons text-[18px]">wb_sunny</span>
            A new puzzle is ready — play now
          </button>
        )}
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
