import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TutorialModal({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Flip the tiles",
      description:
        "Each tile has a word on top and a word on the bottom. Tap the flip handle to swap them.",
      animation: (
        <div className="flex items-center justify-center h-44">
          <motion.div
            animate={{ rotateX: [0, 180, 180, 0, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformStyle: 'preserve-3d' }}
            className="relative flex flex-col w-24 h-44 rounded-2xl bg-tile-face border border-tile-edge shadow-tile overflow-hidden"
          >
            <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-lg">
              PAPER
            </div>
            <div className="h-px w-full bg-paper-line/60" />
            <div
              className="flex-1 flex items-center justify-center font-normal-tile text-ink text-lg"
              style={{ transform: 'rotateX(180deg)' }}
            >
              CLIP
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-tile-face text-ink border border-tile-edge flex items-center justify-center shadow-md z-10">
              <span className="material-icons text-[18px]">swap_vert</span>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      title: "Read the clues",
      description:
        "Four clues frame the board. Place the right tiles in the slots so each clue's compound word appears along its edge.",
      animation: (
        <div className="flex items-center justify-center h-44 w-full">
          <div className="grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-2 place-items-center">
            <div className="col-start-2 row-start-1 font-clue text-[10px] text-ink-muted bg-tile-face border border-tile-edge px-3 py-1 rounded-full whitespace-nowrap">
              Where you catch a flight
            </div>
            <div className="col-start-1 row-start-2 font-clue text-[10px] text-ink-muted bg-tile-face border border-tile-edge px-3 py-1 rounded-full transform rotate-180 [writing-mode:vertical-rl]">
              Plane's path
            </div>
            <div className="col-start-2 row-start-2 flex gap-2 p-2 bg-surface-deep/40 rounded-xl shadow-slot-inset">
              <div className="w-14 h-28 bg-tile-face border border-accent/40 rounded-lg flex flex-col overflow-hidden shadow-tile">
                <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-xs">AIR</div>
                <div className="h-px bg-paper-line/60" />
                <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-xs">WAY</div>
              </div>
              <div className="w-14 h-28 bg-tile-face border border-accent/40 rounded-lg flex flex-col overflow-hidden shadow-tile">
                <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-xs">PORT</div>
                <div className="h-px bg-paper-line/60" />
                <div className="flex-1 flex items-center justify-center font-normal-tile text-ink text-xs">SIDE</div>
              </div>
            </div>
            <div className="col-start-3 row-start-2 font-clue text-[10px] text-ink-muted bg-tile-face border border-tile-edge px-3 py-1 rounded-full [writing-mode:vertical-rl]">
              Ship's left
            </div>
            <div className="col-start-2 row-start-3 font-clue text-[10px] text-accent bg-accent-soft border border-accent/40 px-3 py-1 rounded-full whitespace-nowrap">
              Edge of the road
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Rotate when stuck",
      description:
        "Some puzzles only click into place after a quarter turn. If the clues fight you, give the board a spin.",
      animation: (
        <div className="flex items-center justify-center h-44 relative">
          <motion.div
            animate={{ rotate: [0, 0, 90, 90, 0, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="w-32 h-32 bg-surface-deep/40 rounded-2xl shadow-slot-inset flex items-center justify-center relative"
          >
            <div className="absolute top-2 font-ui text-[10px] text-ink-soft uppercase tracking-widest">Top</div>
            <div className="absolute bottom-2 font-ui text-[10px] text-ink-soft uppercase tracking-widest">Btm</div>
            <span className="material-icons text-ink-soft text-[20px]">grid_view</span>
          </motion.div>
          <div className="absolute top-0 right-2 w-10 h-10 flex items-center justify-center bg-tile-face border border-tile-edge rounded-full shadow-tile z-20">
            <span className="material-icons text-xl text-ink-muted">rotate_right</span>
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(50,30,5,0.45) 0%, rgba(20,15,5,0.7) 100%)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <motion.div
          key={step}
          initial={{ y: 20, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -10, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="bg-tile-face rounded-3xl w-full max-w-md p-6 md:p-8 shadow-tile-lift flex flex-col relative overflow-hidden border border-tile-edge"
        >
          <div
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{ background: 'var(--paper-tex)' }}
          />
          <button
            onClick={onComplete}
            className="absolute top-4 right-4 z-10 font-ui text-xs text-ink-soft hover:text-ink bg-surface-deep/50 hover:bg-surface-deep px-3 py-1 rounded-full transition-colors"
          >
            Skip
          </button>

          <div className="relative flex gap-1.5 mb-7 mt-2 justify-center">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-8 bg-accent' : 'w-2 bg-paper-line/40'
                }`}
              />
            ))}
          </div>

          <div className="relative flex flex-col items-center text-center flex-1">
            <div className="w-full mb-6">{steps[step].animation}</div>
            <h2 className="font-wide-700 text-2xl md:text-3xl text-ink mb-3">
              {steps[step].title}
            </h2>
            <p className="font-clue text-ink-muted leading-relaxed mb-7 px-2">
              {steps[step].description}
            </p>
          </div>

          <div className="relative mt-auto w-full">
            <button
              onClick={handleNext}
              className="font-ui w-full bg-ink hover:bg-ink/85 text-surface py-3.5 rounded-full text-base md:text-lg shadow-tile transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {step === steps.length - 1 ? "Start playing" : "Next"}
              {step !== steps.length - 1 && (
                <span className="material-icons text-[20px]">arrow_forward</span>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
