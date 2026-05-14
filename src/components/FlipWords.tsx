import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, PanInfo } from "framer-motion";
import gsap from "gsap";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import TutorialModal from "./TutorialModal";
import Tile from "./Tile";
import type { Level, Slots, Tile as TileType } from "@/game/types";
import {
  getBoardFaces,
  getEdges,
  getExpectedEdges,
  isLevelSolved,
  normalizeRotation,
  sanitizeState,
} from "@/game/transforms";
import { getNextHintAction, getLevelHintPattern } from "@/game/hint";
import { allLevels, pickSessionLevels } from "@/game/levels";

// Re-export for the admin route
export { allLevels, getLevelHintPattern };
export type { Level };
export const getSolvedEdgeAnswers = (level: Level) => {
  const e = getExpectedEdges(level);
  return { top: e.top, bottom: e.bottom, left: e.left, right: e.right };
};

const SESSION_SIZE = 7;

const fireConfetti = () => {
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;
  const palette = ["#1f9c93", "#f7c454", "#e07a5f", "#3d405b", "#f4f1de"];
  confetti({
    particleCount: 70,
    spread: 70,
    startVelocity: 36,
    origin: { x: 0.2, y: 0.45 },
    colors: palette,
    scalar: 0.9,
  });
  confetti({
    particleCount: 70,
    spread: 70,
    startVelocity: 36,
    origin: { x: 0.8, y: 0.45 },
    colors: palette,
    scalar: 0.9,
  });
  setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 100,
      startVelocity: 28,
      origin: { x: 0.5, y: 0.35 },
      colors: palette,
      scalar: 1.1,
    });
  }, 250);
};

const playPopSound = (() => {
  let muted = false;
  return () => {
    if (muted) return;
    try {
      const Ctx: typeof AudioContext =
        (window.AudioContext || (window as any).webkitAudioContext) as any;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(620, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      muted = true;
    }
  };
})();

export default function FlipWords() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [gameLevels, setGameLevels] = useState<Level[]>([]);
  const [levelIdx, setLevelIdx] = useState(0);
  const [bank, setBank] = useState<TileType[]>([]);
  const [slots, setSlots] = useState<Slots>([null, null]);
  const [boardRotation, setBoardRotation] = useState(0);
  const [turns, setTurns] = useState(0);
  const [hintMessage, setHintMessage] = useState("");
  const [isSolved, setIsSolved] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const slotRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const trayRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<Slots>([null, null]);
  const bankRef = useRef<TileType[]>([]);
  const boardRotationRef = useRef(0);
  const boardFrameRef = useRef<HTMLDivElement>(null);
  const winSequenceFired = useRef(false);

  const level = gameLevels[levelIdx];

  useEffect(() => {
    const hasSeenTutorial =
      typeof window !== "undefined" &&
      window.localStorage.getItem("flipwords_tutorial_seen");
    if (!hasSeenTutorial) setShowTutorial(true);
  }, []);

  const handleTutorialComplete = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("flipwords_tutorial_seen", "true");
    }
    setShowTutorial(false);
  }, []);

  useEffect(() => {
    setGameLevels(pickSessionLevels(SESSION_SIZE));
  }, []);

  const expectedEdges = useMemo(
    () => (level ? getExpectedEdges(level) : null),
    [level]
  );

  const commitState = useCallback(
    (
      nextSlots: Slots,
      nextBank: TileType[],
      nextBoardRotation: number,
      bumpTurns = false
    ) => {
      if (!level) return;
      const normalized = sanitizeState(level, nextSlots, nextBank);
      const normalizedRotation = normalizeRotation(nextBoardRotation);
      slotsRef.current = normalized.slots;
      bankRef.current = normalized.bank;
      boardRotationRef.current = normalizedRotation;
      setSlots(normalized.slots);
      setBank(normalized.bank);
      setBoardRotation(normalizedRotation);
      if (bumpTurns) setTurns((n) => n + 1);
    },
    [level]
  );

  // Init level
  useEffect(() => {
    if (!level) return;
    const initialBank: TileType[] = level.tiles.map((t) => ({
      ...t,
      isFlipped: Math.random() > 0.5,
    }));
    const normalized = sanitizeState(level, [null, null], initialBank);
    slotsRef.current = normalized.slots;
    bankRef.current = normalized.bank;
    boardRotationRef.current = 0;
    setBank(normalized.bank);
    setSlots(normalized.slots);
    setIsSolved(false);
    setShowCelebration(false);
    setActiveSlot(null);
    setBoardRotation(0);
    setTurns(0);
    setHintMessage("");
    winSequenceFired.current = false;
  }, [levelIdx, level]);

  // Animate board rotation through GSAP for a richer feel
  useEffect(() => {
    if (!boardFrameRef.current) return;
    gsap.to(boardFrameRef.current, {
      rotate: boardRotation,
      duration: 0.65,
      ease: "back.out(1.3)",
      overwrite: "auto",
    });
  }, [boardRotation]);

  // Win detection
  useEffect(() => {
    if (!level) return;
    const solved = isLevelSolved(slots, boardRotation, level);
    if (solved && !isSolved) {
      setIsSolved(true);
      setActiveSlot(null);
      // Run the celebratory edge-glow sequence, then confetti, then bottom sheet
      if (!winSequenceFired.current) {
        winSequenceFired.current = true;
        const edges = ["top", "right", "bottom", "left"];
        edges.forEach((edge, i) => {
          const el = boardFrameRef.current?.querySelector(`[data-edge="${edge}"]`);
          if (!el) return;
          gsap.to(el, {
            boxShadow: "0 0 0 2px var(--color-accent), 0 0 24px rgba(31,156,147,0.4)",
            scale: 1.04,
            duration: 0.22,
            delay: i * 0.18,
            yoyo: true,
            repeat: 1,
            ease: "power2.inOut",
          });
        });
        setTimeout(() => {
          fireConfetti();
          setShowCelebration(true);
        }, 950);
      }
    } else if (!solved && isSolved) {
      setIsSolved(false);
    }
  }, [slots, level, boardRotation, isSolved]);

  if (!level || !expectedEdges) return null;

  const handleDragEnd = (_e: any, info: PanInfo, tile: TileType) => {
    if (isSolved) return;
    const { point } = info;
    const currentSlots = [...slotsRef.current] as Slots;
    const currentBank = [...bankRef.current];

    for (let i = 0; i < 2; i++) {
      const el = slotRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (
        point.x >= rect.left &&
        point.x <= rect.right &&
        point.y >= rect.top &&
        point.y <= rect.bottom
      ) {
        const nextSlots = [...currentSlots] as Slots;
        const targetIdx = i as 0 | 1;
        const existingTile = nextSlots[targetIdx];
        nextSlots[targetIdx] = tile;
        let nextBank = currentBank.filter((entry) => entry.id !== tile.id);
        if (existingTile && existingTile.id !== tile.id) {
          nextBank = [...nextBank, existingTile];
        }
        commitState(nextSlots, nextBank, boardRotationRef.current, true);
        setActiveSlot(null);
        setHintMessage("");
        playPopSound();
        return;
      }
    }
  };

  const handleSlotDragEnd = (
    _e: any,
    info: PanInfo,
    tile: TileType,
    slotIdx: number
  ) => {
    if (isSolved) return;
    const { point } = info;
    const sourceIdx = slotIdx as 0 | 1;
    const otherSlotIdx = (slotIdx === 0 ? 1 : 0) as 0 | 1;
    const currentSlots = [...slotsRef.current] as Slots;
    const currentBank = [...bankRef.current];

    const otherEl = slotRefs.current[otherSlotIdx];
    if (otherEl) {
      const rect = otherEl.getBoundingClientRect();
      const droppedInOther =
        point.x >= rect.left &&
        point.x <= rect.right &&
        point.y >= rect.top &&
        point.y <= rect.bottom;
      if (droppedInOther) {
        const nextSlots = [...currentSlots] as Slots;
        const otherTile = nextSlots[otherSlotIdx];
        nextSlots[sourceIdx] = otherTile;
        nextSlots[otherSlotIdx] = tile;
        commitState(nextSlots, currentBank, boardRotationRef.current, true);
        setActiveSlot(null);
        setHintMessage("");
        playPopSound();
        return;
      }
    }

    const sourceEl = slotRefs.current[sourceIdx];
    if (!sourceEl) return;
    const sourceRect = sourceEl.getBoundingClientRect();
    const droppedInSelf =
      point.x >= sourceRect.left &&
      point.x <= sourceRect.right &&
      point.y >= sourceRect.top &&
      point.y <= sourceRect.bottom;

    if (!droppedInSelf) {
      const nextSlots = [...currentSlots] as Slots;
      nextSlots[sourceIdx] = null;
      commitState(nextSlots, [...currentBank, tile], boardRotationRef.current, true);
      setActiveSlot(null);
      setHintMessage("");
      playPopSound();
    }
  };

  const handleHint = () => {
    if (isSolved) return;
    const hint = getNextHintAction(
      level,
      slotsRef.current,
      bankRef.current,
      boardRotationRef.current
    );
    setHintMessage(hint.text);

    // Auto-apply the suggested move
    if (!hint.action) return;
    const currentSlots = [...slotsRef.current] as Slots;
    const currentBank = [...bankRef.current];

    if (hint.action === "removeTile") {
      for (const slotIdx of [0, 1] as const) {
        const current = currentSlots[slotIdx];
        if (!current) continue;
        // If this tile doesn't match its target, remove it
        const expectedTop =
          slotIdx === 0 ? level.solution.slot0Top : level.solution.slot1Top;
        const expectedBottom =
          slotIdx === 0 ? level.solution.slot0Bottom : level.solution.slot1Bottom;
        const matches =
          (current.top === expectedTop && current.bottom === expectedBottom) ||
          (current.top === expectedBottom && current.bottom === expectedTop);
        if (!matches) {
          const nextSlots = [...currentSlots] as Slots;
          nextSlots[slotIdx] = null;
          commitState(
            nextSlots,
            [...currentBank, current],
            boardRotationRef.current
          );
          setActiveSlot(null);
          playPopSound();
          return;
        }
      }
    } else if (hint.action === "addTile") {
      for (const slotIdx of [0, 1] as const) {
        if (currentSlots[slotIdx]) continue;
        const expectedTop =
          slotIdx === 0 ? level.solution.slot0Top : level.solution.slot1Top;
        const expectedBottom =
          slotIdx === 0 ? level.solution.slot0Bottom : level.solution.slot1Bottom;
        const target = level.tiles.find(
          (t) =>
            (t.top === expectedTop && t.bottom === expectedBottom) ||
            (t.top === expectedBottom && t.bottom === expectedTop)
        );
        if (!target) continue;
        // It might currently be in the OTHER slot, in the bank, or missing entirely
        const otherIdx = (slotIdx === 0 ? 1 : 0) as 0 | 1;
        const nextSlots = [...currentSlots] as Slots;
        let nextBank = [...currentBank];
        if (nextSlots[otherIdx]?.id === target.id) {
          nextBank = [...nextBank, nextSlots[otherIdx] as TileType];
          nextSlots[otherIdx] = null;
        } else {
          nextBank = nextBank.filter((t) => t.id !== target.id);
        }
        nextSlots[slotIdx] = {
          ...target,
          isFlipped: target.top !== expectedTop,
        };
        commitState(nextSlots, nextBank, boardRotationRef.current);
        setActiveSlot(null);
        playPopSound();
        return;
      }
    } else if (hint.action === "rotateTile") {
      for (const slotIdx of [0, 1] as const) {
        const current = currentSlots[slotIdx];
        if (!current) continue;
        const expectedTop =
          slotIdx === 0 ? level.solution.slot0Top : level.solution.slot1Top;
        const correctOrientation = current.top === expectedTop;
        if (!correctOrientation) {
          const nextSlots = [...currentSlots] as Slots;
          nextSlots[slotIdx] = { ...current, isFlipped: !current.isFlipped };
          commitState(nextSlots, currentBank, boardRotationRef.current);
          setActiveSlot(null);
          playPopSound();
          return;
        }
      }
    } else if (hint.action === "rotateBoard") {
      commitState(currentSlots, currentBank, boardRotationRef.current + 90);
      setActiveSlot(null);
      playPopSound();
    } else if (hint.action === "rotateBoardBack") {
      commitState(currentSlots, currentBank, boardRotationRef.current - 90);
      setActiveSlot(null);
      playPopSound();
    }
  };

  const handleBankTileClick = (tile: TileType) => {
    if (isSolved) return;
    const currentSlots = [...slotsRef.current] as Slots;
    const currentBank = [...bankRef.current];
    let targetIdx = activeSlot;
    if (targetIdx === null || currentSlots[targetIdx] !== null) {
      targetIdx = currentSlots.indexOf(null);
    }
    if (targetIdx !== -1 && targetIdx !== null) {
      const slotIdx = targetIdx as 0 | 1;
      const nextSlots = [...currentSlots] as Slots;
      const existing = nextSlots[slotIdx];
      nextSlots[slotIdx] = tile;
      let nextBank = currentBank.filter((entry) => entry.id !== tile.id);
      if (existing && existing.id !== tile.id) {
        nextBank = [...nextBank, existing];
      }
      commitState(nextSlots, nextBank, boardRotationRef.current, true);
      setActiveSlot(null);
      setHintMessage("");
      playPopSound();
    }
  };

  const handleEmptySlotClick = (idx: number) => {
    if (isSolved) return;
    setActiveSlot(idx === activeSlot ? null : idx);
  };

  const handleSlotTileClick = (slotIdx: number, tile: TileType) => {
    if (isSolved) return;
    const currentSlots = [...slotsRef.current] as Slots;
    const currentBank = [...bankRef.current];
    const nextSlots = [...currentSlots] as Slots;
    nextSlots[slotIdx as 0 | 1] = null;
    commitState(
      nextSlots,
      [...currentBank, tile],
      boardRotationRef.current,
      true
    );
    setHintMessage("");
    playPopSound();
    if (activeSlot === null) setActiveSlot(slotIdx);
  };

  const flipTileInBank = (id: string) => {
    if (isSolved) return;
    const currentSlots = [...slotsRef.current] as Slots;
    const nextBank = bankRef.current.map((tile) =>
      tile.id === id ? { ...tile, isFlipped: !tile.isFlipped } : tile
    );
    commitState(currentSlots, nextBank, boardRotationRef.current, true);
    setHintMessage("");
  };

  const flipTileInSlot = (slotIdx: number) => {
    if (isSolved) return;
    const currentSlots = [...slotsRef.current] as Slots;
    const currentBank = [...bankRef.current];
    const nextSlots = [...currentSlots] as Slots;
    const tile = nextSlots[slotIdx as 0 | 1];
    if (tile) {
      nextSlots[slotIdx as 0 | 1] = { ...tile, isFlipped: !tile.isFlipped };
      commitState(nextSlots, currentBank, boardRotationRef.current, true);
      setHintMessage("");
      playPopSound();
    }
  };

  const nextLevel = () => {
    if (levelIdx < gameLevels.length - 1) {
      setLevelIdx(levelIdx + 1);
    } else {
      setGameLevels(pickSessionLevels(SESSION_SIZE));
      setLevelIdx(0);
    }
  };

  // Pre-compute the visible edge text for live preview
  const liveFaces = getBoardFaces(slots, boardRotation);
  const liveEdges = getEdges(liveFaces);

  const ScreenEdgePill = ({
    edge,
    clue,
    answer,
  }: {
    edge: "top" | "right" | "bottom" | "left";
    clue: string;
    answer: string | null;
  }) => {
    const correct =
      answer !== null &&
      (edge === "top"
        ? answer === expectedEdges.top
        : edge === "bottom"
        ? answer === expectedEdges.bottom
        : edge === "left"
        ? answer === expectedEdges.left
        : answer === expectedEdges.right);
    return (
      <div
        data-edge={edge}
        className={cn(
          "relative font-clue-strong text-ink-muted bg-tile-face/85 backdrop-blur-sm border border-tile-edge rounded-full px-3 py-1.5 md:px-4 md:py-2 text-[10px] md:text-xs shadow-tile transition-colors",
          edge === "left" || edge === "right" ? "[writing-mode:vertical-rl]" : "",
          edge === "left" ? "rotate-180" : "",
          correct && "text-accent border-accent/40 bg-accent-soft"
        )}
      >
        <span className="whitespace-nowrap">{clue}</span>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-paper">
      {showTutorial && <TutorialModal onComplete={handleTutorialComplete} />}

      <header className="w-full max-w-3xl mx-auto px-4 md:px-6 pt-4 md:pt-6 flex items-center justify-between flex-shrink-0">
        <div className="flex items-baseline gap-2">
          <h1 className="font-wide text-2xl md:text-3xl text-ink leading-none">
            FLIPWORDS
          </h1>
          <span className="text-accent text-xl md:text-2xl leading-none">·</span>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex flex-col items-end mr-1">
            <p className="text-[10px] md:text-[11px] font-ui text-ink-soft uppercase tracking-[0.14em] leading-none">
              Puzzle {levelIdx + 1}
              <span className="text-ink-soft/60">/{gameLevels.length}</span>
            </p>
            <p className="text-xs md:text-sm font-expand text-ink leading-none mt-1.5">
              {turns} turn{turns === 1 ? "" : "s"}
            </p>
          </div>

          <button
            onClick={() => setShowTutorial(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center font-ui bg-tile-face border border-tile-edge text-ink-muted hover:text-ink hover:shadow-tile-hover transition-all active:scale-95"
            title="How to play"
            aria-label="How to play"
          >
            <span className="material-icons text-[18px]">help_outline</span>
          </button>

          <button
            onClick={handleHint}
            className="font-ui flex items-center gap-1.5 text-xs md:text-sm bg-ink text-surface px-3 py-2 md:px-4 md:py-2 rounded-full hover:bg-ink/85 transition-all active:scale-95 shadow-tile"
            title="Hint"
          >
            <span className="material-icons text-[16px]">lightbulb</span>
            <span className="hidden sm:inline">Hint</span>
          </button>
        </div>
      </header>

      {/* Hint banner */}
      <div className="w-full max-w-3xl mx-auto px-4 md:px-6 mt-3 min-h-[1.5rem] flex-shrink-0">
        <AnimatePresence mode="wait">
          {hintMessage ? (
            <motion.p
              key={hintMessage}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="font-clue text-xs md:text-sm text-accent"
            >
              <span className="material-icons align-text-bottom text-[14px] mr-1">
                lightbulb
              </span>
              {hintMessage}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </div>

      {/* Game board */}
      <div className="flex-1 min-h-0 w-full max-w-3xl mx-auto px-4 md:px-6 mt-2 md:mt-4 flex items-center justify-center z-10">
        <div className="relative bg-tile-face/60 backdrop-blur-sm border border-tile-edge rounded-3xl shadow-tile p-4 md:p-8 w-full">
          <button
            onClick={() => {
              commitState(
                slotsRef.current,
                bankRef.current,
                boardRotationRef.current + 90,
                true
              );
              setHintMessage("");
              playPopSound();
            }}
            className="absolute top-3 right-3 md:top-5 md:right-5 w-10 h-10 rounded-full flex items-center justify-center bg-tile-face border border-tile-edge text-ink-muted hover:text-ink hover:shadow-tile-hover transition-all active:scale-95 z-20"
            title="Rotate board"
            aria-label="Rotate board"
          >
            <span className="material-icons text-xl">rotate_right</span>
          </button>

          <div
            ref={boardFrameRef}
            className="grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-2 md:gap-4 place-items-center gpu"
            style={{ transformOrigin: "center center" }}
          >
            {/* Top edge */}
            <div className="col-start-2 row-start-1">
              <ScreenEdgePill edge="top" clue={level.hints.topRow} answer={liveEdges.top} />
            </div>

            {/* Left edge */}
            <div className="col-start-1 row-start-2">
              <ScreenEdgePill
                edge="left"
                clue={level.hints.leftCol}
                answer={liveEdges.left}
              />
            </div>

            {/* Slots */}
            <div className="col-start-2 row-start-2 flex gap-3 md:gap-4 p-3 md:p-4 bg-surface-deep/40 rounded-2xl shadow-slot-inset">
              {[0, 1].map((idx) => {
                const tile = slots[idx as 0 | 1];
                const isActive = activeSlot === idx;
                return (
                  <div
                    key={`slot-${idx}`}
                    onClick={() => !tile && handleEmptySlotClick(idx)}
                    ref={(el) => {
                      slotRefs.current[idx] = el;
                    }}
                    className={cn(
                      "w-[clamp(5rem,14vh,8rem)] h-[clamp(10rem,28vh,16rem)] rounded-2xl flex items-center justify-center relative transition-colors cursor-pointer",
                      tile
                        ? "border-0"
                        : isActive
                        ? "border-2 border-accent bg-accent-soft/50"
                        : "border-2 border-dashed border-paper-line/60 bg-surface/40"
                    )}
                  >
                    {tile ? (
                      <div className="absolute inset-0 z-10">
                        <Tile
                          tile={tile}
                          inSlot={true}
                          draggable={true}
                          boardRotation={boardRotation}
                          onDragEnd={(e, info) => handleSlotDragEnd(e, info, tile, idx)}
                          onClick={() => handleSlotTileClick(idx, tile)}
                          onFlip={() => flipTileInSlot(idx)}
                        />
                      </div>
                    ) : (
                      <span
                        className={cn(
                          "font-ui text-sm select-none transition-colors",
                          isActive ? "text-accent" : "text-ink-soft/50"
                        )}
                        style={{ transform: `rotate(${-boardRotation}deg)` }}
                      >
                        Slot {idx + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right edge */}
            <div className="col-start-3 row-start-2">
              <ScreenEdgePill
                edge="right"
                clue={level.hints.rightCol}
                answer={liveEdges.right}
              />
            </div>

            {/* Bottom edge */}
            <div className="col-start-2 row-start-3">
              <ScreenEdgePill
                edge="bottom"
                clue={level.hints.bottomRow}
                answer={liveEdges.bottom}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bank */}
      <div className="w-full flex-shrink-0 relative z-10 pt-4 md:pt-6 pb-6 md:pb-8">
        <div className="text-center mb-4">
          <p className="font-ui text-[10px] md:text-xs text-ink-soft uppercase tracking-[0.2em]">
            Tile rail
          </p>
        </div>
        <div className="w-full relative flex flex-col items-center justify-center">
          <div ref={trayRef} className="w-full flex items-center justify-center overflow-visible z-10 px-4">
            <motion.div
              drag="x"
              dragConstraints={trayRef}
              className="flex gap-3 md:gap-4 w-max cursor-grab active:cursor-grabbing pb-2"
            >
              <AnimatePresence mode="popLayout">
                {bank.map((tile) => (
                  <motion.div
                    key={tile.id}
                    layout
                    initial={{ opacity: 0, scale: 0.85, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    className="flex-shrink-0"
                  >
                    <Tile
                      tile={tile}
                      inSlot={false}
                      draggable={true}
                      onDragEnd={(e, info) => handleDragEnd(e, info, tile)}
                      onClick={() => handleBankTileClick(tile)}
                      onFlip={() => flipTileInBank(tile.id)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>

          {bank.length === 0 && !isSolved && (
            <div className="flex items-center justify-center text-ink-soft font-ui w-full text-sm mt-4">
              Rail is empty.
            </div>
          )}
        </div>
      </div>

      {/* Win bottom sheet */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="fixed bottom-0 left-0 w-full z-40 flex flex-col items-center justify-center bg-tile-face border-t-4 border-accent rounded-t-[2rem] p-8 pb-12 shadow-[0_-20px_50px_rgba(60,40,10,0.15)]"
          >
            <div className="absolute inset-0 rounded-t-[2rem] pointer-events-none opacity-50"
                 style={{ background: "var(--paper-tex)" }} />
            <div className="relative w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-3 shadow-tile">
              <span className="material-icons text-[28px]">check</span>
            </div>
            <p className="font-ui text-xs text-ink-soft uppercase tracking-[0.2em] mb-2">
              Solved · {turns} turn{turns === 1 ? "" : "s"}
            </p>
            <h2 className="relative font-wide text-3xl md:text-4xl text-ink mb-1 text-center">
              Click. Click. Click.
            </h2>
            <p className="relative font-clue text-sm text-ink-muted mb-6 text-center max-w-md px-4">
              {expectedEdges.top.toLowerCase()} · {expectedEdges.bottom.toLowerCase()} · {expectedEdges.left.toLowerCase()} · {expectedEdges.right.toLowerCase()}
            </p>
            <button
              onClick={nextLevel}
              className="relative font-ui flex items-center gap-2 bg-ink hover:bg-ink/85 text-surface px-8 py-3 md:px-10 md:py-4 rounded-full text-base md:text-lg shadow-tile transition-all active:scale-95"
            >
              {levelIdx < gameLevels.length - 1 ? "Next puzzle" : "New session"}
              <span className="material-icons text-[20px]">arrow_forward</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
