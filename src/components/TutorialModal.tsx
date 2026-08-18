import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnimatedWordmark from './AnimatedWordmark';
import { Icon } from './Icon';
import { useEdition } from '@/edition';

// Faithful miniature of a Tile face — same gradient bg, paper texture, top
// highlight, and divider-with-divot the real Tile renders. Used in scenes 2
// and 3 so the tutorial reads as the same game it's teaching.
function MiniTileFace({
  top,
  bottom,
  size = 'md',
}: {
  top: string;
  bottom: string;
  size?: 'sm' | 'md';
}) {
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-[11px]';
  return (
    <div
      className="absolute inset-0 flex flex-col r-tile overflow-hidden bg-tile-face border border-tile-edge"
      style={{ backfaceVisibility: 'hidden' }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background:
            'repeating-linear-gradient(135deg, rgb(var(--texture-rgb) / 0.03) 0px, rgb(var(--texture-rgb) / 0.03) 1px, transparent 1px, transparent 6px)',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none r-tile-t bg-gradient-to-b from-white/55 to-transparent" />
      <div className={`flex-1 flex items-center justify-center font-normal-tile text-ink ${textSize}`}>
        {top}
      </div>
      <div className="relative h-px w-full">
        <div className="absolute inset-x-2 h-px bg-paper-line/60" />
        <div className="absolute left-1/2 -translate-x-1/2 -top-[3px] h-[6px] w-[6px] rounded-full bg-tile-edge shadow-inner" />
      </div>
      <div className={`flex-1 flex items-center justify-center font-normal-tile text-ink ${textSize}`}>
        {bottom}
      </div>
    </div>
  );
}

function CluePill({
  edge,
  children,
  highlight = false,
}: {
  edge: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactNode;
  highlight?: boolean;
}) {
  const vertical = edge === 'left' || edge === 'right';
  return (
    <motion.div
      animate={
        highlight
          ? {
              boxShadow: [
                '0 0 0 0 rgb(var(--accent-rgb) / 0)',
                '0 0 0 3px var(--color-accent-soft)',
                '0 0 0 0 rgb(var(--accent-rgb) / 0)',
              ],
              borderColor: [
                'var(--color-tile-edge)',
                'var(--color-accent)',
                'var(--color-tile-edge)',
              ],
            }
          : undefined
      }
      transition={
        highlight
          ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 1.8 }
          : undefined
      }
      className={`font-clue-strong text-[9px] text-ink-muted bg-tile-face/85 backdrop-blur-sm border border-tile-edge r-pill px-2.5 py-0.5 shadow-tile whitespace-nowrap ${
        vertical ? '[writing-mode:vertical-rl]' : ''
      } ${edge === 'left' ? 'rotate-180' : ''}`}
    >
      {children}
    </motion.div>
  );
}

export default function TutorialModal({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const { config } = useEdition();

  const steps = [
    {
      // Short caps label for the step strip. Kept to one word so three of
      // them plus "Skip" still fit the header on a 320px screen.
      tab: 'Flip',
      title: 'Flip the tiles',
      description:
        'Each tile carries a word on top and a word underneath. Flip it to swap which one is showing.',
      animation: (
        <div className="flex flex-col items-center justify-center gap-3 h-44">
          <AnimatedWordmark
            text={config.wordmark}
            className="tut-wordmark text-2xl text-ink"
          />
          <div
            className="relative flex items-center justify-center"
            style={{ perspective: 1000 }}
          >
            <motion.div
              animate={{ rotateX: [0, 0, 180, 180, 0, 0] }}
              transition={{
                duration: 4.4,
                repeat: Infinity,
                ease: 'easeInOut',
                times: [0, 0.15, 0.35, 0.65, 0.85, 1],
              }}
              style={{ transformStyle: 'preserve-3d' }}
              className="relative w-[68px] h-[112px] r-tile gpu"
            >
              {/* front face */}
              <div
                className="absolute inset-0 flex flex-col r-tile overflow-hidden bg-tile-face border border-tile-edge shadow-tile"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <div
                  className="absolute inset-0 pointer-events-none opacity-60"
                  style={{
                    background:
                      'repeating-linear-gradient(135deg, rgb(var(--texture-rgb) / 0.03) 0px, rgb(var(--texture-rgb) / 0.03) 1px, transparent 1px, transparent 6px)',
                  }}
                />
                <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none r-tile-t bg-gradient-to-b from-white/55 to-transparent" />
                <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-sm">
                  PAPER
                </div>
                <div className="relative h-px w-full">
                  <div className="absolute inset-x-2 h-px bg-paper-line/60" />
                  <div className="absolute left-1/2 -translate-x-1/2 -top-[3px] h-[7px] w-[7px] rounded-full bg-tile-edge shadow-inner" />
                </div>
                <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-sm">
                  CLIP
                </div>
              </div>
              {/* back face — same construction, just rotated so the front is
                  always upright when we see it */}
              <div
                className="absolute inset-0 flex flex-col r-tile overflow-hidden bg-tile-face border border-tile-edge shadow-tile"
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateX(180deg)',
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none opacity-60"
                  style={{
                    background:
                      'repeating-linear-gradient(135deg, rgb(var(--texture-rgb) / 0.03) 0px, rgb(var(--texture-rgb) / 0.03) 1px, transparent 1px, transparent 6px)',
                  }}
                />
                <div className="absolute inset-x-0 top-0 h-1/2 pointer-events-none r-tile-t bg-gradient-to-b from-white/55 to-transparent" />
                <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-sm">
                  CLIP
                </div>
                <div className="relative h-px w-full">
                  <div className="absolute inset-x-2 h-px bg-paper-line/60" />
                  <div className="absolute left-1/2 -translate-x-1/2 -top-[3px] h-[7px] w-[7px] rounded-full bg-tile-edge shadow-inner" />
                </div>
                <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-sm">
                  PAPER
                </div>
              </div>
            </motion.div>
            {/* Flip handle stays anchored to the screen center while the tile
                spins around it — mirrors the real Tile's hover-flip button. */}
            <motion.div
              animate={{ scale: [1, 1, 1.12, 1, 1] }}
              transition={{
                duration: 4.4,
                repeat: Infinity,
                ease: 'easeInOut',
                times: [0, 0.12, 0.18, 0.3, 1],
              }}
              className="flip-fab accent-fill absolute w-9 h-9 rounded-full bg-accent text-white border border-accent/40 flex items-center justify-center shadow-tile-lift z-10"
            >
              <Icon name="flip" size={18} />
            </motion.div>
          </div>
        </div>
      ),
    },
    {
      tab: 'Clues',
      title: 'Read the clues',
      description:
        "Four clues frame the board. Place the right tiles in the slots so each clue's compound word appears along its edge.",
      animation: (
        <div className="flex items-center justify-center h-44 w-full">
          <div className="relative grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-x-1.5 gap-y-2 place-items-center">
            <div className="col-start-2 row-start-1">
              <CluePill edge="top" highlight>
                Where you catch a flight
              </CluePill>
            </div>
            <div className="col-start-1 row-start-2">
              <CluePill edge="left" highlight>
                Plane's path
              </CluePill>
            </div>
            <div className="col-start-2 row-start-2 flex gap-1.5 p-1.5 bg-surface-deep/40 r-tile shadow-slot-inset">
              <motion.div
                initial={{ y: 26, opacity: 0, scale: 0.92 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.55,
                  type: 'spring',
                  stiffness: 320,
                  damping: 22,
                }}
                className="relative w-10 h-[72px]"
              >
                <MiniTileFace top="AIR" bottom="WAY" />
              </motion.div>
              <motion.div
                initial={{ y: 26, opacity: 0, scale: 0.92 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{
                  delay: 1.2,
                  type: 'spring',
                  stiffness: 320,
                  damping: 22,
                }}
                className="relative w-10 h-[72px]"
              >
                <MiniTileFace top="PORT" bottom="SIDE" />
              </motion.div>
            </div>
            <div className="col-start-3 row-start-2">
              <CluePill edge="right" highlight>
                Ship's left
              </CluePill>
            </div>
            <div className="col-start-2 row-start-3">
              <CluePill edge="bottom" highlight>
                Edge of the road
              </CluePill>
            </div>
          </div>
        </div>
      ),
    },
    {
      tab: 'Rotate',
      title: 'Rotate when stuck',
      description:
        'Some puzzles only click into place after a quarter turn. If the clues fight you, give the board a spin.',
      animation: (
        <div className="flex items-center justify-center h-44 w-full">
          <div className="relative grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-x-1.5 gap-y-2 place-items-center">
            <div className="col-start-2 row-start-1">
              <CluePill edge="top">Where you catch a flight</CluePill>
            </div>
            <div className="col-start-1 row-start-2">
              <CluePill edge="left">Plane's path</CluePill>
            </div>
            {/* Only the slot area spins — edge pills stay anchored, just like
                the real board's rotate FAB. */}
            <motion.div
              animate={{ rotate: [0, 0, 90, 90, 0, 0] }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: [0.34, 1.3, 0.64, 1],
                times: [0, 0.18, 0.38, 0.6, 0.82, 1],
              }}
              style={{ transformOrigin: 'center center' }}
              className="col-start-2 row-start-2 flex gap-1.5 p-1.5 bg-surface-deep/40 r-tile shadow-slot-inset gpu"
            >
              <div className="relative w-10 h-[72px]">
                <MiniTileFace top="AIR" bottom="WAY" />
              </div>
              <div className="relative w-10 h-[72px]">
                <MiniTileFace top="PORT" bottom="SIDE" />
              </div>
            </motion.div>
            <div className="col-start-3 row-start-2">
              <CluePill edge="right">Ship's left</CluePill>
            </div>
            <div className="col-start-2 row-start-3">
              <CluePill edge="bottom">Edge of the road</CluePill>
            </div>
            {/* Rotate FAB — same solid-accent treatment as the real one. */}
            <motion.div
              animate={{
                scale: [1, 1, 1.12, 1, 1, 1.12, 1, 1],
                rotate: [0, 0, 90, 0, 0, 90, 0, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: 'easeInOut',
                times: [0, 0.14, 0.2, 0.32, 0.56, 0.62, 0.74, 1],
              }}
              className="rotate-fab accent-fill absolute -bottom-2 -right-2 z-30 w-9 h-9 rounded-full flex items-center justify-center bg-accent text-white shadow-tile-lift"
            >
              <Icon name="rotate" size={18} />
            </motion.div>
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else onComplete();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="tm-scrim fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden"
      >
        <motion.div
          key={step}
          initial={{ y: 20, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -10, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="tut-sheet bg-tile-face r-card w-full max-w-md p-6 md:p-8 shadow-tile-lift flex flex-col relative overflow-hidden border border-tile-edge"
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{ background: 'var(--paper-tex)' }}
          />

          {/* Header — the step strip over a section rule, Skip on the right.
              Replaces the progress dots: same information, set as TM sets a
              sub-nav. Display only; Next/Skip still drive the sequence. */}
          <div className="relative flex items-end justify-between gap-3 rule-heavy pb-2 mb-5">
            <ol className="flex items-end gap-3.5">
              {steps.map((s, i) => (
                <li
                  key={s.tab}
                  aria-current={i === step ? 'step' : undefined}
                  className={`tut-step tm-eyebrow tm-eyebrow-sm ${
                    i === step ? 'text-ink' : 'text-ink-soft'
                  }`}
                >
                  {s.tab}
                </li>
              ))}
            </ol>
            <button
              onClick={onComplete}
              className="tm-eyebrow tm-eyebrow-sm pb-1.5 text-ink-soft hover:text-ink transition-colors"
            >
              Skip
            </button>
          </div>

          <div className="tut-body relative flex flex-col items-center text-center flex-1">
            <div className="tut-figure w-full mb-5">{steps[step].animation}</div>
            <h2 className="tut-title tm-display font-wide-700 text-2xl md:text-3xl text-ink mb-3">
              {steps[step].title}
            </h2>
            <p className="tut-deck font-clue text-ink-muted leading-relaxed mb-6 px-1">
              {steps[step].description}
            </p>
          </div>

          <div className="tut-foot relative mt-auto w-full">
            <button
              onClick={handleNext}
              className="tut-cta btn-primary font-ui w-full bg-ink hover:bg-ink/85 text-surface py-3.5 r-btn text-base md:text-lg shadow-tile transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {step === steps.length - 1 ? 'Start playing' : 'Next'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
