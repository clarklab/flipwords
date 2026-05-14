import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TutorialModal({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Flip the Tiles",
      description: "Tap the flip icon to turn a tile over and reveal different words.",
      animation: (
        <div className="flex items-center justify-center h-48">
          <motion.div
            animate={{ rotateX: [0, 180, 180, 0, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformStyle: "preserve-3d" }}
            className="relative flex flex-col w-24 h-48 rounded-xl bg-white border-2 border-zinc-200 shadow-sm overflow-hidden"
          >
            <div className="flex-1 flex items-center justify-center p-2 text-center text-lg font-extrabold text-black">
              PAPER
            </div>
            <div className="h-0.5 w-full bg-zinc-100" />
            <div className="flex-1 flex items-center justify-center p-2 text-center text-lg font-extrabold text-black" style={{ transform: "rotateX(180deg)" }}>
              CLIP
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white text-black border border-zinc-200 flex items-center justify-center shadow-md z-10">
              <span className="material-icons text-[18px]">sync</span>
            </div>
          </motion.div>
        </div>
      ),
    },
    {
      title: "Rotate the Board",
      description: "Some puzzles require you to rotate the board to find the correct orientation.",
      animation: (
        <div className="flex items-center justify-center h-48 relative">
          <motion.div
            animate={{ rotate: [0, 90, 90, 180, 180, 270, 270, 360, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="w-32 h-32 border-4 border-dashed border-zinc-300 rounded-2xl flex items-center justify-center bg-slate-50 relative"
          >
            <div className="absolute top-2 text-xs font-bold text-zinc-400">Top</div>
            <div className="absolute bottom-2 text-xs font-bold text-zinc-400">Bottom</div>
            <div className="absolute left-2 text-xs font-bold text-zinc-400 transform -rotate-90">Left</div>
            <div className="absolute right-2 text-xs font-bold text-zinc-400 transform rotate-90">Right</div>
          </motion.div>
          <div className="absolute top-0 right-8 w-10 h-10 flex items-center justify-center bg-white border border-zinc-200 rounded-full shadow-sm z-20">
            <span className="material-icons text-xl">rotate_right</span>
          </div>
        </div>
      ),
    },
    {
      title: "Match the Answers",
      description: "Drag tiles into the slots to match the hints on all sides to win!",
      animation: (
        <div className="flex items-center justify-center h-48 w-full max-w-sm mx-auto">
          <div className="grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-2 place-items-center">
            {/* Top */}
            <div className="col-start-2 row-start-1 text-xs font-bold text-zinc-400 bg-white border border-zinc-200 px-2 py-1 rounded-full">
              Edge of road
            </div>
            {/* Left */}
            <div className="col-start-1 row-start-2 text-xs font-bold text-zinc-400 bg-white border border-zinc-200 px-2 py-1 rounded-full transform -rotate-180 [writing-mode:vertical-rl]">
              Route for planes
            </div>
            
            {/* Slots */}
            <div className="col-start-2 row-start-2 flex gap-2 p-2 bg-white rounded-xl border border-zinc-200 shadow-inner">
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 1, repeat: Infinity, repeatType: "reverse", repeatDelay: 2 }}
                className="w-16 h-32 bg-[#ccff00] border-2 border-black rounded-lg flex flex-col overflow-hidden text-black"
              >
                <div className="flex-1 flex items-center justify-center text-xs font-bold">AIR</div>
                <div className="h-0.5 w-full bg-black/20" />
                <div className="flex-1 flex items-center justify-center text-xs font-bold">WAY</div>
              </motion.div>
              <div className="w-16 h-32 border-2 border-zinc-300 border-dashed rounded-lg bg-slate-50 flex items-center justify-center">
                 <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-[#a3cc00]"
                 >
                    <span className="material-icons">check_circle</span>
                 </motion.div>
              </div>
            </div>

            {/* Right */}
            <div className="col-start-3 row-start-2 text-xs font-bold text-zinc-400 bg-white border border-zinc-200 px-2 py-1 rounded-full [writing-mode:vertical-rl]">
              Ship side
            </div>
            {/* Bottom */}
            <div className="col-start-2 row-start-3 text-xs font-bold text-zinc-400 bg-white border border-zinc-200 px-2 py-1 rounded-full">
              Airport
            </div>
          </div>
        </div>
      ),
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      >
        <motion.div
          key={step}
          initial={{ y: 20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl flex flex-col relative overflow-hidden"
        >
          {/* Skip Button */}
          <button
            onClick={onComplete}
            className="absolute top-4 right-4 text-zinc-400 hover:text-black transition-colors text-sm font-bold bg-zinc-100 hover:bg-zinc-200 px-3 py-1 rounded-full"
          >
            Skip
          </button>

          {/* Progress Indicators */}
          <div className="flex gap-2 mb-8 mt-2 justify-center">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-8 bg-[#a3cc00]" : "w-2 bg-zinc-200"
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="flex flex-col items-center text-center flex-1">
            <div className="w-full mb-8">
              {steps[step].animation}
            </div>
            
            <h2 className="text-2xl font-black text-black mb-3">
              {steps[step].title}
            </h2>
            <p className="text-zinc-500 font-medium leading-relaxed mb-8">
              {steps[step].description}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-auto w-full">
            <button
              onClick={handleNext}
              className="w-full bg-black hover:bg-zinc-800 text-white py-4 rounded-xl font-bold text-lg shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {step === steps.length - 1 ? "Let's Play!" : "Next"}
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
