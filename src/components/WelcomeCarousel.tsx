import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * A compact, auto-advancing teaser of the full TutorialModal. Shown in place
 * of the stat row on the title screen for first-time visitors (sessionsPlayed === 0).
 * Three slides cycle every ~3.8s with crossfade transitions. Animations are
 * scaled-down versions of the tutorial's flip / clues / rotate scenes.
 */

const STEP_MS = 3800

const STEPS = [
  { label: 'Step 1', title: 'Flip the tiles', Anim: FlipAnim },
  { label: 'Step 2', title: 'Read the clues', Anim: CluesAnim },
  { label: 'Step 3', title: 'Rotate when stuck', Anim: RotateAnim },
] as const

export default function WelcomeCarousel() {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }
    const id = window.setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS)
    return () => window.clearInterval(id)
  }, [])

  const { label, title, Anim } = STEPS[step]

  return (
    <div className="mt-4 px-4 py-3 rounded-[26px] border border-tile-edge bg-tile-face flex items-center gap-4 overflow-hidden h-[104px]">
      <div className="flex-shrink-0 w-[80px] h-[80px] flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <Anim />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            <p className="font-ui text-[10px] text-accent uppercase tracking-[0.18em] mb-1">
              {label}
            </p>
            <p className="font-wide-700 text-[16px] text-ink leading-tight mb-2">
              {title}
            </p>
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-[3px] rounded-full transition-all duration-300 ${
                i === step ? 'w-5 bg-accent' : 'w-1.5 bg-paper-line/50'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Tile face matched to the project's Tile component — gradient bg, paper
// texture, top highlight, divider with divot. Kept inline so the carousel is
// self-contained and the tutorial's MiniTileFace stays at its own scale.
function CarouselTile({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col rounded-md overflow-hidden bg-tile-face border border-tile-edge"
      style={{ backfaceVisibility: 'hidden' }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            'repeating-linear-gradient(135deg, rgba(120,90,40,0.03) 0px, rgba(120,90,40,0.03) 1px, transparent 1px, transparent 6px)',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none bg-gradient-to-b from-white/55 to-transparent" />
      <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-[7px] leading-none px-0.5">
        {top}
      </div>
      <div className="relative h-px w-full">
        <div className="absolute inset-x-1 h-px bg-paper-line/60" />
        <div className="absolute left-1/2 -translate-x-1/2 -top-[2px] h-[3px] w-[3px] rounded-full bg-tile-edge" />
      </div>
      <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-[7px] leading-none px-0.5">
        {bottom}
      </div>
    </div>
  )
}

function FlipAnim() {
  return (
    <div className="relative flex items-center justify-center" style={{ perspective: 800 }}>
      <motion.div
        animate={{ rotateX: [0, 0, 180, 180, 0, 0] }}
        transition={{
          duration: 3.4,
          repeat: Infinity,
          ease: 'easeInOut',
          times: [0, 0.18, 0.38, 0.62, 0.82, 1],
        }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative w-[38px] h-[64px] gpu shadow-tile rounded-md"
      >
        {/* front face */}
        <div
          className="absolute inset-0 flex flex-col rounded-md overflow-hidden bg-tile-face border border-tile-edge"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none bg-gradient-to-b from-white/55 to-transparent" />
          <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-[9px] leading-none">
            PAPER
          </div>
          <div className="relative h-px w-full">
            <div className="absolute inset-x-1.5 h-px bg-paper-line/60" />
            <div className="absolute left-1/2 -translate-x-1/2 -top-[2px] h-[4px] w-[4px] rounded-full bg-tile-edge" />
          </div>
          <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-[9px] leading-none">
            CLIP
          </div>
        </div>
        {/* back face */}
        <div
          className="absolute inset-0 flex flex-col rounded-md overflow-hidden bg-tile-face border border-tile-edge"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
        >
          <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none bg-gradient-to-b from-white/55 to-transparent" />
          <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-[9px] leading-none">
            CLIP
          </div>
          <div className="relative h-px w-full">
            <div className="absolute inset-x-1.5 h-px bg-paper-line/60" />
            <div className="absolute left-1/2 -translate-x-1/2 -top-[2px] h-[4px] w-[4px] rounded-full bg-tile-edge" />
          </div>
          <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-[9px] leading-none">
            PAPER
          </div>
        </div>
      </motion.div>
      {/* Stationary flip handle — overlays the spinning tile, evokes the in-game
          swap_vert FAB. */}
      <motion.div
        animate={{ scale: [1, 1, 1.18, 1, 1] }}
        transition={{
          duration: 3.4,
          repeat: Infinity,
          ease: 'easeInOut',
          times: [0, 0.12, 0.2, 0.34, 1],
        }}
        className="absolute w-4 h-4 rounded-full bg-accent text-white flex items-center justify-center shadow-tile-lift z-10"
      >
        <span className="material-icons text-[10px]">swap_vert</span>
      </motion.div>
    </div>
  )
}

function CluesAnim() {
  // Mini board with two slots and four pulsing clue bars — one per edge.
  return (
    <div className="relative grid grid-cols-[8px_auto_8px] grid-rows-[8px_auto_8px] gap-x-1 gap-y-1 place-items-center">
      {/* Top clue */}
      <motion.div
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: 0 }}
        className="col-start-2 row-start-1 h-[3px] w-[28px] rounded-full bg-accent"
      />
      {/* Left clue (vertical) */}
      <motion.div
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: 0.45 }}
        className="col-start-1 row-start-2 w-[3px] h-[28px] rounded-full bg-accent"
      />
      {/* Slots */}
      <div className="col-start-2 row-start-2 flex gap-0.5 p-0.5 bg-surface-deep/40 rounded-md shadow-slot-inset">
        <div className="relative w-[16px] h-[28px]">
          <CarouselTile top="AIR" bottom="WAY" />
        </div>
        <div className="relative w-[16px] h-[28px]">
          <CarouselTile top="PORT" bottom="SIDE" />
        </div>
      </div>
      {/* Right clue (vertical) */}
      <motion.div
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: 0.9 }}
        className="col-start-3 row-start-2 w-[3px] h-[28px] rounded-full bg-accent"
      />
      {/* Bottom clue */}
      <motion.div
        animate={{ opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: 1.35 }}
        className="col-start-2 row-start-3 h-[3px] w-[28px] rounded-full bg-accent"
      />
    </div>
  )
}

function RotateAnim() {
  return (
    <div className="relative">
      <motion.div
        animate={{ rotate: [0, 0, 90, 90, 0, 0] }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: [0.34, 1.3, 0.64, 1],
          times: [0, 0.18, 0.38, 0.6, 0.82, 1],
        }}
        style={{ transformOrigin: 'center center' }}
        className="flex gap-0.5 p-0.5 bg-surface-deep/40 rounded-md shadow-slot-inset gpu"
      >
        <div className="relative w-[18px] h-[32px]">
          <CarouselTile top="AIR" bottom="WAY" />
        </div>
        <div className="relative w-[18px] h-[32px]">
          <CarouselTile top="PORT" bottom="SIDE" />
        </div>
      </motion.div>
      {/* Rotate FAB — pulses on the beats where the board turns. */}
      <motion.div
        animate={{
          scale: [1, 1, 1.18, 1, 1, 1.18, 1, 1],
          rotate: [0, 0, 90, 0, 0, 90, 0, 0],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
          times: [0, 0.14, 0.2, 0.32, 0.56, 0.62, 0.74, 1],
        }}
        className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center bg-accent text-white shadow-tile-lift"
      >
        <span className="material-icons text-[11px]">rotate_right</span>
      </motion.div>
    </div>
  )
}
