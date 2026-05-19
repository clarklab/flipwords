import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import FlipWords from '@/components/FlipWords'
import Scorecard from '@/components/Scorecard'
import { getSessionForDate } from '@/daily/schedule'
import { easternDateString, dayNumber } from '@/daily/date'
import { loadStorage, saveStorage } from '@/daily/storage'
import { recordCompletion } from '@/daily/streak'
import { formatShareString, shareSession } from '@/daily/share'
import type { SessionResult, StoredSession } from '@/daily/types'

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
  // original day (per the design spec edge case).
  const [startDate] = useState(() => easternDateString())
  const session = useMemo(() => getSessionForDate(startDate), [startDate])
  const dn = dayNumber(startDate)

  const [existingResult, setExistingResult] = useState<StoredSession | null>(
    () => loadStorage().sessions[startDate] ?? null
  )
  const [practiceMode, setPracticeMode] = useState(false)
  const [shareFallbackText, setShareFallbackText] = useState<string | null>(null)

  const handleComplete = (result: SessionResult) => {
    const next = recordCompletion(loadStorage(), startDate, result)
    saveStorage(next)
    setExistingResult(next.sessions[startDate] ?? null)
  }

  const handlePractice = () => {
    setPracticeMode(true)
  }

  const handleShare = async (input: { dayNumber: number; stars: 1 | 2 | 3; totalDurationMs: number }) => {
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
          onPractice={handlePractice}
          onArchive={() => navigate({ to: '/archive' })}
          onShare={() => void handleShare({ dayNumber: dn, stars: existingResult.stars, totalDurationMs: existingResult.totalDurationMs })}
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
          session={session}
          date={startDate}
          dayNumber={dn}
          mode="daily"
          showTutorial={tutorialFromSearch}
          scorecardPrimaryLabel="Share result"
          scorecardPrimaryIcon="ios_share"
          onScorecardPrimary={() => {
            // Read fresh from storage — existingResult state may not have updated
            // yet on the very first React re-render after onComplete fires.
            const stored = loadStorage().sessions[startDate]
            if (!stored) return
            void handleShare({ dayNumber: dn, stars: stored.stars, totalDurationMs: stored.totalDurationMs })
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
  onPractice,
  onArchive,
  onShare,
}: {
  result: StoredSession
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
