import { motion, AnimatePresence } from 'framer-motion'

export type ScorecardStats = {
  attempts: number
  hints: number
  durationMs: number
  stars: 1 | 2 | 3
}

export type ScorecardProps = {
  open: boolean
  headline: string
  overallStars: 1 | 2 | 3
  totalStars: number
  possibleStars: number
  sessionDurationMs: number
  totalGuesses: number
  totalHints: number
  perPuzzle: ScorecardStats[]
  primaryLabel: string
  primaryIcon: string
  onPrimary: () => void
  streak?: {
    current: number
    best: number
    deltaThisSession: boolean
  } | null
}

const formatDuration = (ms: number): string => {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Scorecard(props: ScorecardProps) {
  const {
    open,
    headline,
    overallStars,
    totalStars,
    possibleStars,
    sessionDurationMs,
    totalGuesses,
    totalHints,
    perPuzzle,
    primaryLabel,
    primaryIcon,
    onPrimary,
    streak,
  } = props

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scorecard-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(50,30,5,0.45) 0%, rgba(20,15,5,0.7) 100%)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            key="scorecard-card"
            initial={{ y: 20, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="bg-tile-face rounded-3xl w-full max-w-md p-6 md:p-8 shadow-tile-lift flex flex-col items-center"
          >
            <p className="font-ui text-[11px] text-ink-soft uppercase tracking-[0.22em] mb-3">
              Session complete
            </p>

            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3].map((n) => {
                const filled = n <= overallStars
                const delay = 0.2 + n * 0.15
                return (
                  <div
                    key={n}
                    className="relative inline-flex items-center justify-center w-[56px] h-[56px]"
                  >
                    {filled && (
                      <motion.span
                        aria-hidden
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [0, 2.1, 2.4], opacity: [0, 0.85, 0] }}
                        transition={{ delay, duration: 0.65, times: [0, 0.35, 1], ease: 'easeOut' }}
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                          background:
                            'radial-gradient(circle, rgba(247,196,84,0.85) 0%, rgba(247,196,84,0.35) 38%, rgba(247,196,84,0) 70%)',
                          willChange: 'transform, opacity',
                        }}
                      />
                    )}
                    <motion.span
                      initial={{ scale: 0, rotate: -180, opacity: 0 }}
                      animate={
                        filled
                          ? {
                              scale: [0, 1.55, 0.85, 1.12, 1],
                              rotate: [-180, 25, -10, 5, 0],
                              opacity: [0, 1, 1, 1, 1],
                            }
                          : { scale: [0, 0.7, 1], rotate: [-90, 10, 0], opacity: [0, 1, 1] }
                      }
                      transition={{
                        delay,
                        duration: filled ? 0.75 : 0.5,
                        times: filled ? [0, 0.45, 0.68, 0.86, 1] : [0, 0.6, 1],
                        ease: 'easeOut',
                      }}
                      className="material-icons relative text-[44px] leading-none"
                      style={{
                        color: filled ? 'var(--color-accent)' : 'var(--color-tile-edge)',
                        filter: filled ? 'drop-shadow(0 4px 14px rgba(31,156,147,0.55))' : 'none',
                        fontVariationSettings: filled
                          ? '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 48'
                          : '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 48',
                        willChange: 'transform, opacity',
                      }}
                    >
                      star
                    </motion.span>
                  </div>
                )
              })}
            </div>

            <h2 className="font-wide text-2xl md:text-3xl text-ink text-center leading-tight mb-1">
              {headline}
            </h2>
            <p className="font-clue text-sm text-ink-muted text-center mb-5">
              {totalStars} of {possibleStars} stars across {perPuzzle.length} puzzles
            </p>

            {streak && (
              <div className="w-full mb-4 bg-tile-face border border-tile-edge rounded-[18px] px-3.5 py-3 flex items-center justify-between shadow-tile">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-10 h-10 rounded-full inline-flex items-center justify-center"
                    style={{ background: 'oklch(94% 0.04 38)', color: 'oklch(64% 0.16 38)' }}
                  >
                    <span
                      className="material-icons text-[22px]"
                      style={{ fontVariationSettings: '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 24' }}
                    >
                      local_fire_department
                    </span>
                  </span>
                  <div className="flex flex-col">
                    <span className="font-ui text-[9.5px] text-ink-soft uppercase tracking-[0.18em]">
                      Streak
                    </span>
                    <span className="font-wide text-[26px] text-ink leading-none flex items-baseline gap-1.5">
                      {streak.current}
                      {streak.deltaThisSession && (
                        <span
                          className="font-ui text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-[0.08em]"
                          style={{ background: 'oklch(94% 0.04 38)', color: 'oklch(64% 0.16 38)' }}
                        >
                          +1 today
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-ui text-[9.5px] text-ink-soft uppercase tracking-[0.18em]">Best</p>
                  <p className="font-expand text-[18px] text-ink leading-none mt-0.5">{streak.best}</p>
                </div>
              </div>
            )}

            <div className="w-full grid grid-cols-3 gap-2 mb-5">
              {[
                { label: 'Time', value: formatDuration(sessionDurationMs) },
                { label: 'Guesses', value: totalGuesses.toString() },
                { label: 'Hints', value: totalHints.toString() },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl bg-surface-deep/40 px-2 py-3 text-center shadow-slot-inset"
                >
                  <p className="font-ui text-[10px] text-ink-soft uppercase tracking-[0.16em] mb-1">
                    {stat.label}
                  </p>
                  <p className="font-expand text-xl text-ink leading-none">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="w-full mb-6 rounded-2xl border border-tile-edge bg-surface/50 divide-y divide-paper-line/30">
              {perPuzzle.map((stat, i) => (
                <div key={i} className="flex items-center justify-between px-3.5 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-ui text-xs text-ink-soft uppercase tracking-wider">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="font-clue text-sm text-ink-muted">
                      {stat.attempts} {stat.attempts === 1 ? 'guess' : 'guesses'}
                      {stat.hints > 0 && (
                        <>
                          , {stat.hints} hint{stat.hints === 1 ? '' : 's'}
                        </>
                      )}
                      <span className="text-ink-soft/60"> · {formatDuration(stat.durationMs)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3].map((n) => {
                      const isFilled = n <= stat.stars
                      return (
                        <span
                          key={n}
                          className="material-icons text-[16px]"
                          style={{
                            color: isFilled ? 'var(--color-accent)' : 'var(--color-tile-edge)',
                            fontVariationSettings: isFilled
                              ? '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 20'
                              : '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 20',
                          }}
                        >
                          star
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onPrimary}
              className="w-full font-ui flex items-center justify-center gap-2 bg-ink hover:bg-ink/85 text-surface py-3.5 rounded-full text-base shadow-tile transition-all active:scale-95"
            >
              {primaryLabel}
              <span className="material-icons text-[20px]">{primaryIcon}</span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
