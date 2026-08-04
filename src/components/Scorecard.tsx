import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from './Icon'

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
          className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-4 pb-24"
          style={{
            background:
              'radial-gradient(ellipse at center, rgb(var(--scrim-rgb) / 0.45) 0%, rgb(var(--scrim-rgb) / 0.7) 100%)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            key="scorecard-card"
            initial={{ y: 20, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="bg-tile-face r-card w-full max-w-md p-5 md:p-6 shadow-tile-lift flex flex-col items-center"
          >
            {/* All six SESSION_HEADLINES are inside the display face's
                65-glyph trial charset (space , . 0-9 A-Z a-z), so this can
                take the didone under Texas without a fallback glyph. */}
            <h2 className="display-headline score-headline font-wide text-2xl md:text-3xl text-ink text-center leading-tight mb-3">
              {headline}
            </h2>

            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3].map((n) => {
                const filled = n <= overallStars
                const delay = 0.2 + n * 0.15
                return (
                  <div
                    key={n}
                    className="relative inline-flex items-center justify-center w-[48px] h-[48px]"
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
                            'radial-gradient(circle, rgb(var(--star-rgb) / 0.85) 0%, rgb(var(--star-rgb) / 0.35) 38%, rgb(var(--star-rgb) / 0) 70%)',
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
                      className="relative block"
                      style={{
                        // --star-empty, not --color-tile-edge directly: under
                        // Texas that token is near-black illustration ink, and
                        // three solid black stars read as a warning, not as
                        // "unearned."
                        color: filled ? 'var(--color-accent)' : 'var(--star-empty)',
                        filter: filled ? 'drop-shadow(0 4px 14px rgb(var(--accent-rgb) / 0.55))' : 'none',
                        willChange: 'transform, opacity',
                      }}
                    >
                      <Icon name="star" size={38} filled={filled} />
                    </motion.span>
                  </div>
                )
              })}
            </div>

            <p className="deck-line font-clue text-sm text-ink-muted text-center mb-4">
              {totalStars} of {possibleStars} stars across {perPuzzle.length} puzzles
            </p>

            {streak && (
              <div className="w-full mb-3 bg-tile-face border border-tile-edge fab-outline r-panel px-3.5 py-2.5 flex items-center justify-between shadow-tile">
                <div className="flex items-center gap-2.5">
                  {/* Was a pair of hardcoded oklch literals that survived the
                      edition swap (docs §5.3). Now --flame-*, which resolve to
                      sunflower-on-ink under Texas — TM Games' signature field
                      colour, and the doc's suggested celebration cue. */}
                  <span className="flame-chip w-10 h-10 rounded-full inline-flex items-center justify-center">
                    <Icon name="flame" size={22} />
                  </span>
                  <div className="flex flex-col">
                    <span className="tm-eyebrow text-ink-soft">Streak</span>
                    <span className="font-wide text-[26px] text-ink leading-none flex items-baseline gap-1.5">
                      {streak.current}
                      {streak.deltaThisSession && (
                        <span className="flame-chip tm-eyebrow px-1.5 py-0.5 r-pill">
                          +1 today
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="tm-eyebrow text-ink-soft">Best</p>
                  <p className="font-expand text-[18px] text-ink leading-none mt-0.5">{streak.best}</p>
                </div>
              </div>
            )}

            <div className="w-full grid grid-cols-3 gap-2 mb-3">
              {[
                { label: 'Time', value: formatDuration(sessionDurationMs) },
                { label: 'Guesses', value: totalGuesses.toString() },
                { label: 'Hints', value: totalHints.toString() },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="tint-panel r-panel bg-surface-deep/40 px-2 py-2.5 text-center shadow-slot-inset"
                >
                  <p className="tm-eyebrow text-ink-soft mb-1">{stat.label}</p>
                  <p className="font-expand text-xl text-ink leading-none">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Hairline box, not the heavy outline the drawn objects wear —
                TM sets data modules (TRENDING, READER FAVORITES) in rules this
                light, and three heavy boxes stacked would fight the stars. */}
            <div className="w-full mb-4 r-panel border border-tile-edge bg-surface/50 divide-y divide-paper-line/30">
              {perPuzzle.map((stat, i) => (
                <div key={i} className="flex items-center justify-between px-3.5 py-1.5">
                  <div className="flex items-baseline gap-2">
                    <span className="tm-eyebrow text-ink-soft">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="font-clue text-sm text-ink-muted">
                      {stat.attempts} {stat.attempts === 1 ? 'guess' : 'guesses'}
                      {stat.hints > 0 && (
                        <>
                          , {stat.hints} hint{stat.hints === 1 ? '' : 's'}
                        </>
                      )}
                      <span className="sc-row-time text-ink-soft/60"> · {formatDuration(stat.durationMs)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3].map((n) => {
                      const isFilled = n <= stat.stars
                      return (
                        <Icon
                          key={n}
                          name="star"
                          size={16}
                          filled={isFilled}
                          style={{
                            color: isFilled ? 'var(--color-accent)' : 'var(--star-empty)',
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onPrimary}
              className="btn-primary w-full font-ui flex items-center justify-center gap-2 bg-ink hover:bg-ink/85 text-surface py-3 r-btn text-base shadow-tile transition-all active:scale-95"
            >
              {primaryLabel}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
