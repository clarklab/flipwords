import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from './Icon'

/**
 * First-visit onboarding teaser on the title screen (shown in place of the
 * stat row while sessionsPlayed === 0).
 *
 * One persistent mini-board — the real level-1 tiles, AIR/PORT + MAN/HOLE —
 * morphs through four steps instead of crossfading unrelated icons, so a new
 * player watches ONE continuous scene tell the whole story:
 *
 *   1. Two tiles, four words — row/column highlights + the compound they form
 *   2. Flip to fix — the right tile flips (HOLE/MAN → MAN/HOLE), MANHOLE ✓
 *   3. Follow the clues — pills pulse around the four edges
 *   4. Rotate when stuck — the board quarter-turns, words stay upright
 *
 * Steps auto-advance; tapping the card skips ahead. Reduced motion pins the
 * scene to step 1 with no cycling.
 */

const STEP_MS = 4400
const SPRING = { type: 'spring', stiffness: 220, damping: 22 } as const

const STEPS = [
  { title: 'Two tiles, four words', desc: 'Pairs read across and down.' },
  { title: 'Flip to fix', desc: 'Every tile is double-sided.' },
  { title: 'Follow the clues', desc: 'One clue for every edge.' },
  { title: 'Rotate when stuck', desc: 'Some answers sit sideways.' },
] as const

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function WelcomeCarousel() {
  const [step, setStep] = useState(0)
  // The right tile reads HOLE/MAN (wrong way up) until the flip step fixes it.
  const [flipped, setFlipped] = useState(false)
  const [reduce] = useState(prefersReducedMotion)

  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS)
    return () => window.clearInterval(id)
  }, [reduce])

  // Choreograph the flip: it happens mid-step-2 (after the FAB pulse draws the
  // eye), and resets when the loop comes back around to step 1.
  useEffect(() => {
    if (step === 0) setFlipped(false)
    if (step !== 1) return
    const t = window.setTimeout(() => setFlipped(true), 1500)
    return () => window.clearTimeout(t)
  }, [step])

  const advance = () => setStep((s) => (s + 1) % STEPS.length)

  const boardRotation = step === 3 ? 90 : 0
  // Words counter-rotate so they stay readable while the board turns — same
  // trick the real game uses.
  const counter = -boardRotation
  const rotateTransition = { ...SPRING, delay: step === 3 ? 0.7 : 0 }

  return (
    <div
      onClick={advance}
      className="wc-panel relative z-10 mt-4 px-4 pt-3 pb-4 r-card border border-tile-edge bg-transparent overflow-hidden cursor-pointer select-none"
    >
      {/* Eyebrow + progress dots. The coral eyebrow is TM's most-repeated
          device — GAMES, READ NEXT, POLITICS & POLICY are all this. */}
      <div className="flex items-center justify-between">
        <p className="tm-eyebrow tm-eyebrow-sm accent-type text-accent">How to play</p>
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-[4px] r-pill transition-all duration-300 ${
                i === step ? 'w-5 bg-accent' : 'w-1.5 bg-paper-line/60'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Stage */}
      <div aria-hidden="true" className="relative h-28 mt-1 flex items-end justify-center">
        {/* Compound chips — the payoff line for steps 1 & 2. One position,
            staggered fades, so the eye always knows where to look. */}
        <div className="absolute top-0 inset-x-0 h-6 flex items-start justify-center pointer-events-none">
          {step === 0 && !reduce && (
            <>
              <CompoundChip label="AIRMAN" arrow="→" times={[0.06, 0.12, 0.42, 0.5]} />
              <CompoundChip label="AIRPORT" arrow="↓" times={[0.52, 0.58, 0.9, 0.98]} />
            </>
          )}
          {step === 0 && reduce && <StaticChip label="AIRMAN" arrow="→" />}
          {step === 1 && (
            <motion.span
              initial={{ opacity: 0, y: 4, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ ...SPRING, delay: reduce ? 0 : 2.15 }}
              className="accent-fill font-ui inline-flex items-center gap-1 r-pill bg-accent text-white text-[10px] tracking-[0.08em] px-2.5 py-1"
            >
              ↓ MANHOLE
              <Icon name="check" size={11} />
            </motion.span>
          )}
        </div>

        {/* Board wrapper — pills for the clue step live here so they hug the
            board without rotating with it. */}
        <div className="relative mb-1">
          <CluePill side="top" active={step === 2} order={0} />
          <CluePill side="right" active={step === 2} order={1} />
          <CluePill side="bottom" active={step === 2} order={2} />
          <CluePill side="left" active={step === 2} order={3} />

          {/* Rotate FAB — appears for the rotation step, pulses, board turns. */}
          {step === 3 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.25, 1], opacity: 1 }}
              transition={{ duration: 0.5, times: [0, 0.7, 1] }}
              className="rotate-fab absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 accent-fill z-20 size-6 rounded-full bg-accent text-white flex items-center justify-center shadow-tile-lift"
            >
              <Icon name="rotate" size={14} />
            </motion.div>
          )}

          <motion.div
            animate={{ rotate: boardRotation }}
            transition={rotateTransition}
            className="wc-board relative flex gap-1 r-tile bg-surface-deep/40 p-1.5 shadow-slot-inset"
          >
            {/* Row/column highlights for the four-words step */}
            {step === 0 && !reduce && (
              <>
                {/* Across: top halves of both tiles → AIRMAN */}
                <HighlightRect
                  className="left-1.5 right-1.5 top-1.5 h-[30px]"
                  times={[0.06, 0.12, 0.42, 0.5]}
                />
                {/* Down: the whole left tile → AIRPORT */}
                <HighlightRect
                  className="left-1.5 top-1.5 bottom-1.5 w-[42px]"
                  times={[0.52, 0.58, 0.9, 0.98]}
                />
              </>
            )}
            {step === 0 && reduce && (
              <div className="absolute left-1.5 right-1.5 top-1.5 h-[30px] r-mark bg-accent/15 ring-2 ring-accent/70 z-10" />
            )}

            <MiniTile top="AIR" bottom="PORT" counter={counter} counterTransition={rotateTransition} />
            <FlippableTile flipped={flipped || reduce} counter={counter} counterTransition={rotateTransition} showFab={step === 1 && !flipped && !reduce} />
          </motion.div>
        </div>
      </div>

      {/* Caption */}
      <div className="mt-2 text-center h-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            <p className="wc-title tm-serif font-wide-700 text-[16px] text-ink leading-tight">
              {STEPS[step].title}
            </p>
            <p className="font-clue text-[12px] text-ink-muted mt-0.5">
              {STEPS[step].desc}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * A word-pair chip ("→ AIRMAN") that fades in/out on a fraction-of-step
 * schedule, synchronized with its HighlightRect via the same `times`.
 */
function CompoundChip({
  label,
  arrow,
  times,
}: {
  label: string
  arrow: string
  times: [number, number, number, number]
}) {
  const [t0, t1, t2, t3] = times
  return (
    <motion.span
      animate={{ opacity: [0, 0, 1, 1, 0, 0], y: [4, 4, 0, 0, -2, -2] }}
      transition={{
        duration: STEP_MS / 1000,
        times: [0, t0, t1, t2, t3, 1],
        repeat: Infinity,
      }}
      className="accent-fill absolute font-ui inline-flex items-center gap-1 r-pill bg-accent text-white text-[10px] tracking-[0.08em] px-2.5 py-1"
    >
      {arrow} {label}
    </motion.span>
  )
}

function StaticChip({ label, arrow }: { label: string; arrow: string }) {
  return (
    <span className="accent-fill font-ui inline-flex items-center r-pill bg-accent text-white text-[10px] tracking-[0.08em] px-2.5 py-1">
      {arrow} {label}
    </span>
  )
}

/** Accent overlay that sweeps a row/column of the mini-board. */
function HighlightRect({
  className,
  times,
}: {
  className: string
  times: [number, number, number, number]
}) {
  const [t0, t1, t2, t3] = times
  return (
    <motion.div
      animate={{ opacity: [0, 0, 1, 1, 0, 0] }}
      transition={{
        duration: STEP_MS / 1000,
        times: [0, t0, t1, t2, t3, 1],
        repeat: Infinity,
      }}
      className={`absolute r-mark bg-accent/15 ring-2 ring-accent/70 z-10 pointer-events-none ${className}`}
    />
  )
}

/** Edge clue pill that pulses in sequence during the clue step. */
function CluePill({
  side,
  active,
  order,
}: {
  side: 'top' | 'right' | 'bottom' | 'left'
  active: boolean
  order: number
}) {
  const pos =
    side === 'top'
      ? '-top-[9px] left-1/2 -translate-x-1/2 h-[5px] w-12'
      : side === 'bottom'
      ? '-bottom-[9px] left-1/2 -translate-x-1/2 h-[5px] w-12'
      : side === 'left'
      ? '-left-[9px] top-1/2 -translate-y-1/2 w-[5px] h-12'
      : '-right-[9px] top-1/2 -translate-y-1/2 w-[5px] h-12'
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.35, 1, 0.35] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, repeat: Infinity, delay: order * 0.4 }}
          className={`absolute r-pill bg-accent ${pos}`}
        />
      )}
    </AnimatePresence>
  )
}

/** Static mini tile styled after the real game tile. */
function MiniTile({
  top,
  bottom,
  counter,
  counterTransition,
}: {
  top: string
  bottom: string
  counter: number
  counterTransition: object
}) {
  return (
    <div className="relative w-[42px] h-[76px]">
      <TileFace top={top} bottom={bottom} counter={counter} counterTransition={counterTransition} />
    </div>
  )
}

/**
 * The double-sided tile. Front reads HOLE/MAN (unhelpfully upside down);
 * flipping shows the back, MAN/HOLE, completing the right-hand column.
 */
function FlippableTile({
  flipped,
  counter,
  counterTransition,
  showFab,
}: {
  flipped: boolean
  counter: number
  counterTransition: object
  showFab: boolean
}) {
  return (
    <div className="relative w-[42px] h-[76px]" style={{ perspective: 500 }}>
      <motion.div
        animate={{ rotateX: flipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <TileFace top="HOLE" bottom="MAN" counter={counter} counterTransition={counterTransition} />
        {/* Back face: rotateX flips z-rotation handedness, so the counter
            rotation is negated to keep words upright after a board turn. */}
        <TileFace
          top="MAN"
          bottom="HOLE"
          counter={-counter}
          counterTransition={counterTransition}
          back
        />
      </motion.div>
      {/* Flip affordance — mirrors the in-game swap_vert FAB. */}
      <AnimatePresence>
        {showFab && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [0, 1.25, 1], opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.45, times: [0, 0.7, 1], delay: 0.5 }}
            className="flip-fab absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 accent-fill z-20 size-5 rounded-full bg-accent text-white flex items-center justify-center shadow-tile-lift"
          >
            <Icon name="flip" size={12} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TileFace({
  top,
  bottom,
  counter,
  counterTransition,
  back = false,
}: {
  top: string
  bottom: string
  counter: number
  counterTransition: object
  back?: boolean
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col r-mark overflow-hidden bg-tile-face border border-tile-edge shadow-tile"
      style={{
        backfaceVisibility: 'hidden',
        transform: back ? 'rotateX(180deg)' : undefined,
      }}
    >
      <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none bg-gradient-to-b from-white/55 to-transparent" />
      <div className="flex-1 flex items-center justify-center">
        <motion.span
          animate={{ rotate: counter }}
          transition={counterTransition}
          className="font-normal-tile text-ink text-[10px] leading-none inline-block"
        >
          {top}
        </motion.span>
      </div>
      <div className="relative h-px w-full">
        <div className="absolute inset-x-1 h-px bg-paper-line/60" />
        <div className="absolute left-1/2 -translate-x-1/2 -top-[2px] size-[4px] rounded-full bg-tile-edge" />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <motion.span
          animate={{ rotate: counter }}
          transition={counterTransition}
          className="font-normal-tile text-ink text-[10px] leading-none inline-block"
        >
          {bottom}
        </motion.span>
      </div>
    </div>
  )
}
