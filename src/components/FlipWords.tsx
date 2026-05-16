import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, PanInfo } from "framer-motion";
import gsap from "gsap";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import TutorialModal from "./TutorialModal";
import Tile from "./Tile";
import AnimatedWordmark, {
  type AnimatedWordmarkHandle,
} from "./AnimatedWordmark";
import type { Level, Slots, Tile as TileType } from "@/game/types";
import {
  getExpectedEdges,
  isLevelSolved,
  sanitizeState,
} from "@/game/transforms";
import { getNextHintAction, getLevelHintPattern } from "@/game/hint";
import { allLevels, pickSessionLevels } from "@/game/levels";
import {
  playBoardRotate,
  playCorrect,
  playHint,
  playIncorrect,
  playPuzzleComplete,
  playSessionComplete,
  playStarPop,
  playTileDrop,
  playTileFlip,
  playTilePickup,
} from "@/lib/sound";

// Re-export for the admin route
export { allLevels, getLevelHintPattern };
export type { Level };
export const getSolvedEdgeAnswers = (level: Level) => {
  const e = getExpectedEdges(level);
  return { top: e.top, bottom: e.bottom, left: e.left, right: e.right };
};

const SESSION_SIZE = 5;

const SOLVE_HEADLINES = [
  "Click. Click. Click.",
  "Oh yeah!",
  "Bingo.",
  "Locked in.",
  "Beautiful.",
  "Snap. Crackle. Pop.",
  "Got it.",
  "Boom.",
  "All four.",
  "Crystal clear.",
  "Dead on.",
  "That'll do.",
  "Snug fit.",
  "Bullseye.",
  "Smooth.",
  "Sharp.",
  "Solid.",
  "On the nose.",
  "Money.",
  "Tidy.",
  "Cracked it.",
  "Confirmed.",
  "Pieced together.",
  "Buttoned up.",
  "All matched.",
  "There it is.",
  "Bang on.",
  "Hooked it.",
  "Lined up.",
  "Picture perfect.",
  "Done and done.",
  "Sweet.",
  "Stuck the landing.",
  "Threaded the needle.",
  "Yes!",
  "Sealed.",
  "Flipped, fitted, finished.",
  "Effortless.",
  "Page turner.",
  "Nailed it.",
  "Crisp.",
  "Compound complete.",
  "Word.",
  "Tile by tile.",
  "Cards on the table.",
  "Mic drop.",
  "Done deal.",
  "Wordsmith.",
  "Spelled out.",
  "Slot-perfect.",
];

const SESSION_HEADLINES = [
  "Run the table.",
  "Game, set, match.",
  "Vocabulary check passed.",
  "Seven up.",
  "All the way through.",
  "Dictionary unlocked.",
];

const pickHeadline = (pool: string[]) =>
  pool[Math.floor(Math.random() * pool.length)];

const computeStars = (attempts: number, hints: number): 1 | 2 | 3 => {
  if (attempts <= 1 && hints === 0) return 3;
  if (attempts <= 2 && hints <= 1) return 2;
  return 1;
};

const formatDuration = (ms: number): string => {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

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

export default function FlipWords() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [gameLevels, setGameLevels] = useState<Level[]>([]);
  const [levelIdx, setLevelIdx] = useState(0);
  const [bank, setBank] = useState<TileType[]>([]);
  const [slots, setSlots] = useState<Slots>([null, null]);
  const [boardRotation, setBoardRotation] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [hintMessage, setHintMessage] = useState("");
  const [isSolved, setIsSolved] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  // Which slot the dragged tile is currently hovering over (or null). Drives
  // the drop-target highlight.
  const [hoveredSlotIdx, setHoveredSlotIdx] = useState<number | null>(null);
  const [checkState, setCheckState] = useState<
    "idle" | "judging" | "incorrect"
  >("idle");
  // Hint counter for the current puzzle. Reset on level change.
  const [hintsThisPuzzle, setHintsThisPuzzle] = useState(0);
  const [winHeadline, setWinHeadline] = useState<string>(SOLVE_HEADLINES[0]);
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [sessionHeadline, setSessionHeadline] = useState<string>(
    SESSION_HEADLINES[0]
  );
  // Wall-clock elapsed time for the active session, ticked every second.
  // Pauses when the browser tab is hidden and resumes on visibility, so the
  // displayed value matches "time spent actually looking at the puzzle."
  const [elapsedMs, setElapsedMs] = useState(0);

  const slotRefs = useRef<(HTMLDivElement | null)[]>([null, null]);
  const slotsRef = useRef<Slots>([null, null]);
  const bankRef = useRef<TileType[]>([]);
  const boardRotationRef = useRef(0);
  const boardFrameRef = useRef<HTMLDivElement>(null);
  const slotAreaRef = useRef<HTMLDivElement>(null);
  const winSequenceFired = useRef(false);
  // Avoid spamming setState while the user drags by holding the latest value
  // in a ref and only calling the setter when it actually changes.
  const hoveredSlotRef = useRef<number | null>(null);
  const wordmarkRef = useRef<AnimatedWordmarkHandle>(null);
  // Session-scoped stats. Refs because we read them inside callbacks that
  // would otherwise close over stale state. attempts/hints get mirrored from
  // their state setters; perPuzzle accumulates one entry per solve.
  const attemptsRef = useRef(0);
  const hintsThisPuzzleRef = useRef(0);
  const sessionStartRef = useRef<number | null>(null);
  const sessionEndRef = useRef<number | null>(null);
  const perPuzzleRef = useRef<
    Array<{ attempts: number; hints: number; durationMs: number }>
  >([]);
  const puzzleStartRef = useRef<number | null>(null);
  // Timer bookkeeping. visibleStartRef is the wall-clock at which the current
  // "visible" segment began; elapsedAccumRef is the sum of all prior visible
  // segments. While the tab is hidden, visibleStartRef is null and the
  // accumulator holds the frozen total.
  const elapsedAccumRef = useRef(0);
  const visibleStartRef = useRef<number | null>(null);

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
    // Greet the player as the modal slides out.
    window.setTimeout(() => wordmarkRef.current?.flip(), 240);
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
      nextBoardRotation: number
    ) => {
      if (!level) return;
      const normalized = sanitizeState(level, nextSlots, nextBank);
      slotsRef.current = normalized.slots;
      bankRef.current = normalized.bank;
      // Keep the raw (un-normalized) rotation so GSAP animates in the same
      // direction forever — otherwise 270 → 0 wraps and spins backward.
      // Game logic that needs a canonical 0/90/180/270 value calls
      // normalizeRotation on its own.
      boardRotationRef.current = nextBoardRotation;
      setSlots(normalized.slots);
      setBank(normalized.bank);
      setBoardRotation(nextBoardRotation);
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
    // Snap visually to 0 so we don't unwind multiple turns when the previous
    // level left the rotation at e.g. 360 or 720.
    if (slotAreaRef.current) {
      gsap.set(slotAreaRef.current, { rotate: 0 });
    }
    setBank(normalized.bank);
    setSlots(normalized.slots);
    setIsSolved(false);
    setShowCelebration(false);
    setActiveSlot(null);
    setBoardRotation(0);
    setAttempts(0);
    attemptsRef.current = 0;
    setHintsThisPuzzle(0);
    hintsThisPuzzleRef.current = 0;
    setHintMessage("");
    setCheckState("idle");
    winSequenceFired.current = false;
    // Session-scoped state: start the clock on the first puzzle of a session.
    if (sessionStartRef.current === null) {
      sessionStartRef.current = Date.now();
    }
    puzzleStartRef.current = Date.now();
  }, [levelIdx, level]);

  // Animate board rotation through GSAP for a richer feel — only the slot
  // area rotates so the edge labels stay anchored at top/right/bottom/left.
  useEffect(() => {
    if (!slotAreaRef.current) return;
    gsap.to(slotAreaRef.current, {
      rotate: boardRotation,
      duration: 0.65,
      ease: "back.out(1.3)",
      overwrite: "auto",
    });
  }, [boardRotation]);

  // Session timer. Runs from the first puzzle until the session scorecard
  // shows. Pauses on tab hide via the Page Visibility API and resumes when
  // the user comes back. We tick state at 1Hz; refs hold the source of
  // truth so the value stays exact even when ticks are throttled.
  useEffect(() => {
    if (gameLevels.length === 0) return;
    if (showSessionSummary) return;
    if (showTutorial) return;

    if (!document.hidden) {
      visibleStartRef.current = Date.now();
    }

    const tick = () => {
      if (visibleStartRef.current !== null) {
        setElapsedMs(
          elapsedAccumRef.current + (Date.now() - visibleStartRef.current)
        );
      }
    };
    const interval = window.setInterval(tick, 1000);

    const handleVisibility = () => {
      if (document.hidden) {
        if (visibleStartRef.current !== null) {
          elapsedAccumRef.current += Date.now() - visibleStartRef.current;
          visibleStartRef.current = null;
        }
      } else {
        visibleStartRef.current = Date.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      // Bank whatever was visible so resuming picks up where we left off
      // instead of replaying the gap.
      if (visibleStartRef.current !== null) {
        elapsedAccumRef.current += Date.now() - visibleStartRef.current;
        visibleStartRef.current = null;
      }
    };
  }, [gameLevels.length, showSessionSummary, showTutorial]);

  // Session scorecard arrives — fire the grand fanfare and pop a bell for each
  // star, timed against the star animation delays (0.2 + n * 0.15 seconds).
  useEffect(() => {
    if (!showSessionSummary) return;
    playSessionComplete();
    const stats = perPuzzleRef.current.map((p) =>
      computeStars(p.attempts, p.hints)
    );
    const total = stats.reduce((sum, s) => sum + s, 0);
    const possible = stats.length * 3;
    const earned: 1 | 2 | 3 =
      stats.length === 0
        ? 1
        : total === possible
        ? 3
        : total >= possible * (2 / 3)
        ? 2
        : 1;
    const timers: number[] = [];
    for (let n = 1; n <= earned; n++) {
      const t = window.setTimeout(
        () => playStarPop(n - 1),
        (0.2 + n * 0.15) * 1000
      );
      timers.push(t);
    }
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [showSessionSummary]);

  const runWinSequence = useCallback(() => {
    setIsSolved(true);
    setActiveSlot(null);
    if (winSequenceFired.current) return;
    winSequenceFired.current = true;
    // Record per-puzzle stats. attemptsRef was already incremented by
    // handleCheckAnswer before this call, so it reflects the winning guess.
    const now = Date.now();
    const startedAt = puzzleStartRef.current ?? now;
    perPuzzleRef.current.push({
      attempts: attemptsRef.current,
      hints: hintsThisPuzzleRef.current,
      durationMs: now - startedAt,
    });
    // Pick a fresh win headline so the celebration doesn't repeat itself.
    setWinHeadline(pickHeadline(SOLVE_HEADLINES));
    const edges = ["top", "right", "bottom", "left"];
    edges.forEach((edge, i) => {
      const el = boardFrameRef.current?.querySelector(`[data-edge="${edge}"]`);
      if (!el) return;
      gsap.to(el, {
        boxShadow:
          "0 0 0 2px var(--color-accent), 0 0 24px rgba(31,156,147,0.4)",
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
      playPuzzleComplete();
      setShowCelebration(true);
    }, 950);
  }, []);

  const handleCheckAnswer = useCallback(() => {
    if (!level) return;
    if (checkState !== "idle") return;
    if (isSolved) return;
    // Require both slots to be filled before calling the judge.
    if (!slotsRef.current[0] || !slotsRef.current[1]) return;

    attemptsRef.current += 1;
    setAttempts(attemptsRef.current);
    setCheckState("judging");

    window.setTimeout(() => {
      const solved = isLevelSolved(
        slotsRef.current,
        boardRotationRef.current,
        level
      );
      if (solved) {
        // Drop straight from the judging modal into the win sequence — the
        // edge-flash + bottom-sheet celebration is the visual confirmation,
        // so a separate "Correct!" card would just double-dip.
        setCheckState("idle");
        playCorrect();
        runWinSequence();
      } else {
        setCheckState("incorrect");
        playIncorrect();
        window.setTimeout(() => setCheckState("idle"), 1400);
      }
    }, 750);
  }, [level, checkState, isSolved, runWinSequence]);

  if (!level || !expectedEdges) return null;

  const updateHoveredSlot = (point: { x: number; y: number } | null) => {
    let next: number | null = null;
    if (point) {
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
          next = i;
          break;
        }
      }
    }
    if (hoveredSlotRef.current !== next) {
      hoveredSlotRef.current = next;
      setHoveredSlotIdx(next);
    }
  };

  const handleTileDrag = (_e: any, info: PanInfo) => {
    if (isSolved) return;
    updateHoveredSlot(info.point);
  };

  const clearHoveredSlot = () => {
    if (hoveredSlotRef.current !== null) {
      hoveredSlotRef.current = null;
      setHoveredSlotIdx(null);
    }
  };

  const handleDragEnd = (_e: any, info: PanInfo, tile: TileType) => {
    clearHoveredSlot();
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
        commitState(nextSlots, nextBank, boardRotationRef.current);
        setActiveSlot(null);
        setHintMessage("");
        playTileDrop();
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
    clearHoveredSlot();
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
        commitState(nextSlots, currentBank, boardRotationRef.current);
        setActiveSlot(null);
        setHintMessage("");
        playTileDrop();
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
      commitState(nextSlots, [...currentBank, tile], boardRotationRef.current);
      setActiveSlot(null);
      setHintMessage("");
      playTilePickup();
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
    // Count this as a hint used for the session scorecard.
    hintsThisPuzzleRef.current += 1;
    setHintsThisPuzzle(hintsThisPuzzleRef.current);
    playHint();

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
          playTilePickup();
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
        playTileDrop();
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
          playTileFlip();
          return;
        }
      }
    } else if (hint.action === "rotateBoard") {
      commitState(currentSlots, currentBank, boardRotationRef.current + 90);
      setActiveSlot(null);
      playBoardRotate();
    } else if (hint.action === "rotateBoardBack") {
      commitState(currentSlots, currentBank, boardRotationRef.current - 90);
      setActiveSlot(null);
      playBoardRotate();
    }
  };
  // Hint button was removed from the header for the current layout, but the
  // hint system (auto-apply, counter, score weighting) is intentionally kept
  // in place so a UI affordance can be re-added later without rewiring.
  void handleHint;

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
      commitState(nextSlots, nextBank, boardRotationRef.current);
      setActiveSlot(null);
      setHintMessage("");
      playTileDrop();
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
      boardRotationRef.current
    );
    setHintMessage("");
    playTilePickup();
    if (activeSlot === null) setActiveSlot(slotIdx);
  };

  const flipTileInBank = (id: string) => {
    if (isSolved) return;
    const currentSlots = [...slotsRef.current] as Slots;
    const nextBank = bankRef.current.map((tile) =>
      tile.id === id ? { ...tile, isFlipped: !tile.isFlipped } : tile
    );
    commitState(currentSlots, nextBank, boardRotationRef.current);
    setHintMessage("");
    playTileFlip();
  };

  const flipTileInSlot = (slotIdx: number) => {
    if (isSolved) return;
    const currentSlots = [...slotsRef.current] as Slots;
    const currentBank = [...bankRef.current];
    const nextSlots = [...currentSlots] as Slots;
    const tile = nextSlots[slotIdx as 0 | 1];
    if (tile) {
      nextSlots[slotIdx as 0 | 1] = { ...tile, isFlipped: !tile.isFlipped };
      commitState(nextSlots, currentBank, boardRotationRef.current);
      setHintMessage("");
      playTileFlip();
    }
  };

  const isLastPuzzle = levelIdx >= gameLevels.length - 1;

  const nextLevel = () => {
    if (!isLastPuzzle) {
      setLevelIdx(levelIdx + 1);
      return;
    }
    // Last puzzle just got solved — close the per-puzzle sheet and surface
    // the session scorecard.
    if (sessionEndRef.current === null) {
      sessionEndRef.current = Date.now();
    }
    setSessionHeadline(pickHeadline(SESSION_HEADLINES));
    setShowCelebration(false);
    setShowSessionSummary(true);
  };

  const startNewSession = () => {
    sessionStartRef.current = null;
    sessionEndRef.current = null;
    perPuzzleRef.current = [];
    elapsedAccumRef.current = 0;
    visibleStartRef.current = null;
    setElapsedMs(0);
    setShowSessionSummary(false);
    setShowCelebration(false);
    setGameLevels(pickSessionLevels(SESSION_SIZE));
    setLevelIdx(0);
  };

  // Derived scorecard values — only meaningful when showSessionSummary is true,
  // but cheap to compute every render.
  const sessionDuration =
    sessionStartRef.current && sessionEndRef.current
      ? sessionEndRef.current - sessionStartRef.current
      : 0;
  const totalGuesses = perPuzzleRef.current.reduce(
    (sum, p) => sum + p.attempts,
    0
  );
  const totalHints = perPuzzleRef.current.reduce(
    (sum, p) => sum + p.hints,
    0
  );
  const perPuzzleStars = perPuzzleRef.current.map((p) =>
    computeStars(p.attempts, p.hints)
  );
  const totalStars = perPuzzleStars.reduce((sum, s) => sum + s, 0);
  const possibleStars = perPuzzleStars.length * 3;
  // Overall stars mirror the per-puzzle scale: a perfect run earns 3 stars,
  // an average of >= 2 earns 2 stars, anything below averages out to 1.
  const overallStars: 1 | 2 | 3 =
    perPuzzleStars.length === 0
      ? 1
      : totalStars === possibleStars
      ? 3
      : totalStars >= possibleStars * (2 / 3)
      ? 2
      : 1;

  const ScreenEdgePill = ({
    edge,
    clue,
  }: {
    edge: "top" | "right" | "bottom" | "left";
    clue: string;
  }) => {
    return (
      <div
        data-edge={edge}
        className={cn(
          "relative font-clue-strong text-ink-muted bg-tile-face/85 backdrop-blur-sm border border-tile-edge rounded-full px-3.5 py-1.5 md:px-4 md:py-2 shadow-tile transition-colors",
          edge === "left" || edge === "right" ? "[writing-mode:vertical-rl]" : "",
          edge === "left" ? "rotate-180" : ""
        )}
        style={{
          // Fluid sizing — 12px floor on the smallest phones, scales up to
          // ~15px on tablet/desktop. +2px from the previous 10/12 baseline.
          fontSize: "clamp(0.75rem, 1.2vw + 0.62rem, 0.95rem)",
          lineHeight: 1.15,
        }}
      >
        <span className="whitespace-nowrap">{clue}</span>
      </div>
    );
  };

  // Material Symbols clock_loader_* increments 20 → 40 → 60 → 80 → 90 across
  // the 5 puzzles of a session, so the icon visually fills as the player
  // progresses. The session is fixed at SESSION_SIZE, so the lookup is
  // straightforward; fall back to the most-full symbol if the index ever
  // overshoots (it shouldn't, but it keeps a bad state from rendering blank).
  const puzzleProgressIcon = [
    "clock_loader_20",
    "clock_loader_40",
    "clock_loader_60",
    "clock_loader_80",
    "clock_loader_90",
  ][levelIdx] ?? "clock_loader_90";

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-chin overflow-hidden">
      {showTutorial && <TutorialModal onComplete={handleTutorialComplete} />}

      {/* Play surface — the cream paper card that holds the puzzle. Rounded
          bottom corners + a heavy lift shadow let it sit on the green chin
          like a thick playing card on felt. overflow-hidden so the tile
          rail's vertical bleed gets neatly tucked behind the curved edge.
          Everything that was previously at the root (header / hint banner
          / board / tile rail) now lives inside this surface. */}
      <div className="flex-1 min-h-0 flex flex-col bg-paper rounded-b-[28px] md:rounded-b-[36px] shadow-play-lift relative z-10 overflow-hidden">

      <header className="relative w-full max-w-3xl mx-auto px-4 pt-4 md:pt-6 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left — Back FAB. Stand-in for a future title-screen route; for
              now it surfaces the tutorial so users have somewhere to land. */}
          <div className="flex items-center">
            <button
              onClick={() => setShowTutorial(true)}
              className="w-11 h-11 rounded-full flex items-center justify-center font-ui bg-tile-face border border-tile-edge text-ink-muted hover:text-ink hover:shadow-tile-hover transition-all active:scale-95 shadow-tile"
              title="Back"
              aria-label="Back"
            >
              <span className="material-icons text-[22px]">chevron_left</span>
            </button>
          </div>

          {/* Right — Help, swapped for Check once the player has laid tiles.
              The swap doubles as a tutorial: by the time both slots are
              filled, the help button has done its job. */}
          <div className="flex items-center min-h-11">
            <AnimatePresence mode="wait" initial={false}>
              {!isSolved && slots[0] && slots[1] && checkState === "idle" ? (
                <motion.button
                  key="check"
                  initial={{ opacity: 0, scale: 0.85, x: 8 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.85, x: 8 }}
                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                  onClick={handleCheckAnswer}
                  className="font-ui flex items-center gap-1.5 text-sm bg-accent text-white h-11 px-4 md:px-5 rounded-full hover:bg-accent/90 transition-colors active:scale-95 shadow-tile"
                  title="Call the judge"
                >
                  <span className="material-icons text-[18px]">gavel</span>
                  <span>Check</span>
                </motion.button>
              ) : (
                <motion.button
                  key="help"
                  initial={{ opacity: 0, scale: 0.85, x: 8 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.85, x: 8 }}
                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                  onClick={() => setShowTutorial(true)}
                  className="w-11 h-11 rounded-full flex items-center justify-center font-ui bg-tile-face border border-tile-edge text-ink-muted hover:text-ink hover:shadow-tile-hover transition-all active:scale-95 shadow-tile"
                  title="How to play"
                  aria-label="How to play"
                >
                  <span className="material-icons text-[20px]">help_outline</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Centered wordmark — no puzzle counter; that info lives in the chin
            now. pointer-events-none so taps pass through to the FABs. */}
        <div className="absolute inset-x-0 top-4 md:top-6 h-11 flex items-center justify-center pointer-events-none">
          <AnimatedWordmark
            ref={wordmarkRef}
            className="text-xl md:text-2xl text-ink"
          />
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

      {/* Game board — sits directly on the paper surface, no container chrome */}
      <div className="flex-1 min-h-0 w-full max-w-3xl mx-auto px-4 md:px-6 mt-4 md:mt-6 flex items-center justify-center z-10">
        {/* Wrapper is content-sized (no w-full) so the clue pills hug the
            slots even on wide viewports. The parent flex centers the
            whole play area horizontally. */}
        <div className="relative">
          <div
            ref={boardFrameRef}
            className="grid grid-cols-[auto_auto_auto] grid-rows-[auto_auto_auto] gap-x-2 md:gap-x-4 gap-y-5 md:gap-y-10 place-items-center"
          >
            {/* Top edge */}
            <div className="col-start-2 row-start-1">
              <ScreenEdgePill edge="top" clue={level.hints.topRow} />
            </div>

            {/* Left edge */}
            <div className="col-start-1 row-start-2">
              <ScreenEdgePill edge="left" clue={level.hints.leftCol} />
            </div>

            {/* Slots — wrapped in a relative cell so the rotate FAB can
                float dead-center over the slot area without rotating with
                it (slotAreaRef is what GSAP spins). */}
            <div className="col-start-2 row-start-2 relative">
              <button
                onClick={() => {
                  commitState(
                    slotsRef.current,
                    bankRef.current,
                    boardRotationRef.current + 90
                  );
                  setHintMessage("");
                  playBoardRotate();
                }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center bg-accent text-white hover:bg-accent/90 transition-all active:scale-95 shadow-tile-lift"
                title="Rotate board"
                aria-label="Rotate board"
              >
                <span className="material-icons text-[18px] md:text-[20px]">rotate_right</span>
              </button>
              <div
                ref={slotAreaRef}
                className="flex gap-3 md:gap-4 p-3 md:p-4 bg-surface-deep/40 rounded-2xl shadow-slot-inset gpu"
                style={{ transformOrigin: "center center" }}
              >
              {[0, 1].map((idx) => {
                const tile = slots[idx as 0 | 1];
                const isActive = activeSlot === idx;
                const isHovered = hoveredSlotIdx === idx;
                return (
                  <div
                    key={`slot-${idx}`}
                    onClick={() => !tile && handleEmptySlotClick(idx)}
                    ref={(el) => {
                      slotRefs.current[idx] = el;
                    }}
                    className={cn(
                      "w-[var(--tile-w)] h-[var(--tile-h)] rounded-2xl flex items-center justify-center relative cursor-pointer transition-[border-color,background-color,box-shadow,transform] duration-150",
                      // Drop-target highlight wins over every other state. Solid
                      // accent ring, soft glow, faint scale-up so the slot
                      // reads as "I'll catch the tile if you let go now."
                      isHovered
                        ? "border-2 border-accent bg-accent-soft scale-[1.03] shadow-[0_0_0_4px_var(--color-accent-soft),0_12px_28px_-12px_rgba(31,156,147,0.45)]"
                        : tile
                        ? "border-0"
                        : isActive
                        ? "border-2 border-accent bg-accent-soft/50"
                        : "border-2 border-dashed border-paper-line/60 bg-surface/40"
                    )}
                  >
                    {tile ? (
                      <div className="absolute inset-0 z-10">
                        {/* key on tile.id forces a true remount when a slot
                            tile is replaced (e.g., dropping a bank tile onto
                            an occupied slot). Without it, React reuses the
                            same <Tile> instance and just swaps the layoutId
                            prop, which conflicts with the displaced tile
                            now mounting fresh in the bank under that id —
                            Framer Motion ends up hiding one of them. */}
                        <Tile
                          key={tile.id}
                          tile={tile}
                          inSlot={true}
                          draggable={true}
                          boardRotation={boardRotation}
                          onDrag={handleTileDrag}
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
            </div>

            {/* Right edge */}
            <div className="col-start-3 row-start-2">
              <ScreenEdgePill edge="right" clue={level.hints.rightCol} />
            </div>

            {/* Bottom edge */}
            <div className="col-start-2 row-start-3">
              <ScreenEdgePill edge="bottom" clue={level.hints.bottomRow} />
            </div>
          </div>
        </div>
      </div>

      {/* Bank — 5 tiles, sized off --tile-w/--tile-h so the row is exactly
          one viewport wide minus the side bleed. The rack is wider than the
          viewport on small screens (outer tiles peek past the side edges)
          and its bottom hangs past the viewport bottom by --tile-bleed; the
          root's overflow-hidden clips both. No horizontal scroll: with 5
          tiles fitting by design, scroll would just steal drag gestures. */}
      <div className="w-full flex-shrink-0 relative z-10 pt-3 md:pt-5 pb-10 md:pb-8">
        <div className="text-center mb-2">
          <p className="font-ui text-[10px] md:text-xs text-ink-soft uppercase tracking-[0.2em]">
            Tile rail
          </p>
        </div>
        <div
          className="relative w-full"
          style={{ height: "calc(var(--tile-h) - var(--tile-bleed))" }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 flex"
            style={{ gap: "var(--tile-gap)" }}
          >
            {/* No AnimatePresence wrapper — a wrapped motion.div with the
                same layoutId as the Tile inside creates a duplicate
                shared-layout element during drop, which Framer Motion
                renders as a ghost copy on top of the freshly-placed slot
                tile. The Tile already exposes layoutId={tile.id} + layout
                on its own outer motion.div, so dropping the wrapper is
                enough: bank↔slot transitions stay smooth, and remaining
                bank tiles shift via their own layout prop. */}
            {bank.map((tile) => (
              <Tile
                key={tile.id}
                tile={tile}
                inSlot={false}
                draggable={true}
                onDrag={handleTileDrag}
                onDragEnd={(e, info) => handleDragEnd(e, info, tile)}
                onClick={() => handleBankTileClick(tile)}
                onFlip={() => flipTileInBank(tile.id)}
              />
            ))}
          </div>

          {bank.length === 0 && !isSolved && (
            <div className="absolute inset-x-0 top-0 flex items-center justify-center text-ink-soft font-ui text-sm">
              Rail is empty.
            </div>
          )}
        </div>
      </div>

      </div>
      {/* /play-surface */}

      {/* Chin — deep accent strip beneath the play surface. Two-up row of
          status pills: stopwatch on the left, puzzle progress on the right.
          The bottom padding includes the iOS home-indicator safe area so
          the row never gets covered by the system handle. */}
      <div
        className="flex-shrink-0 bg-chin text-surface relative z-0"
        style={{
          paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="w-full max-w-3xl mx-auto px-5 md:px-7 pt-3 md:pt-4 pb-1 flex items-center justify-between gap-4">
          {/* Left — session stopwatch */}
          <div className="flex items-center gap-2">
            <span
              className="material-icons text-surface/85"
              style={{
                fontSize: 26,
                fontVariationSettings:
                  '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 24',
              }}
              aria-hidden="true"
            >
              avg_pace
            </span>
            <span className="font-expand text-[22px] md:text-2xl leading-none tabular-nums tracking-[-0.01em] text-surface">
              {formatDuration(elapsedMs)}
            </span>
          </div>

          {/* Right — puzzle of total */}
          <div className="flex items-center gap-2">
            <span
              className="material-icons text-surface/85"
              style={{
                fontSize: 26,
                fontVariationSettings:
                  '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 24',
              }}
              aria-hidden="true"
            >
              {puzzleProgressIcon}
            </span>
            <p className="font-expand text-[22px] md:text-2xl leading-none text-surface flex items-baseline gap-1.5">
              <span>{levelIdx + 1}</span>
              <span className="font-ui text-sm md:text-base text-surface/70 tracking-wide">
                of {gameLevels.length}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Win card — full-width bottom sheet on mobile, floating card on desktop.
          Sits above the chin (z-40) and covers it while celebrating; the chin
          reappears once the sheet exits and the next puzzle loads. */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed z-40 inset-x-0 bottom-0 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-6 md:w-[calc(100%-2rem)] md:max-w-md flex flex-col items-center bg-tile-face rounded-t-3xl md:rounded-3xl shadow-tile-lift px-6 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] md:p-7"
          >
            <div className="w-11 h-11 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-3">
              <span className="material-icons text-[24px]">check</span>
            </div>
            <p className="font-ui text-[11px] text-ink-soft uppercase tracking-[0.18em] mb-1.5">
              Solved · {attempts} {attempts === 1 ? "check" : "checks"}
              {hintsThisPuzzle > 0 && (
                <>
                  {" · "}
                  {hintsThisPuzzle} {hintsThisPuzzle === 1 ? "hint" : "hints"}
                </>
              )}
            </p>
            <h2 className="font-wide text-2xl md:text-3xl text-ink mb-1 text-center leading-tight">
              {winHeadline}
            </h2>
            <p className="font-clue text-[13px] text-ink-muted mb-5 text-center px-2">
              {expectedEdges.top.toLowerCase()} ·{" "}
              {expectedEdges.bottom.toLowerCase()} ·{" "}
              {expectedEdges.left.toLowerCase()} ·{" "}
              {expectedEdges.right.toLowerCase()}
            </p>
            <button
              onClick={nextLevel}
              className="font-ui flex items-center gap-2 bg-ink hover:bg-ink/85 text-surface px-7 py-3 rounded-full text-base shadow-tile transition-all active:scale-95"
            >
              {isLastPuzzle ? "See scorecard" : "Next puzzle"}
              <span className="material-icons text-[20px]">
                {isLastPuzzle ? "emoji_events" : "arrow_forward"}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* End-of-session scorecard */}
      <AnimatePresence>
        {showSessionSummary && (
          <motion.div
            key="scorecard-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(50,30,5,0.45) 0%, rgba(20,15,5,0.7) 100%)",
              backdropFilter: "blur(8px)",
            }}
          >
            <motion.div
              key="scorecard-card"
              initial={{ y: 20, opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="bg-tile-face rounded-3xl w-full max-w-md p-6 md:p-8 shadow-tile-lift flex flex-col items-center"
            >
              <p className="font-ui text-[11px] text-ink-soft uppercase tracking-[0.22em] mb-3">
                Session complete
              </p>

              {/* Big stars */}
              <div className="flex items-center gap-2 mb-4">
                {[1, 2, 3].map((n) => {
                  const filled = n <= overallStars;
                  return (
                    <motion.span
                      key={n}
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{
                        delay: 0.2 + n * 0.15,
                        type: "spring",
                        damping: 14,
                        stiffness: 220,
                      }}
                      className="material-icons text-[44px]"
                      style={{ color: filled ? "var(--color-accent)" : "var(--color-tile-edge)" }}
                    >
                      {filled ? "star" : "star_outline"}
                    </motion.span>
                  );
                })}
              </div>

              <h2 className="font-wide text-2xl md:text-3xl text-ink text-center leading-tight mb-1">
                {sessionHeadline}
              </h2>
              <p className="font-clue text-sm text-ink-muted text-center mb-5">
                {totalStars} of {possibleStars} stars across {perPuzzleStars.length}{" "}
                puzzles
              </p>

              {/* Headline stats */}
              <div className="w-full grid grid-cols-3 gap-2 mb-5">
                {[
                  { label: "Time", value: formatDuration(sessionDuration) },
                  { label: "Guesses", value: totalGuesses.toString() },
                  { label: "Hints", value: totalHints.toString() },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl bg-surface-deep/40 px-2 py-3 text-center shadow-slot-inset"
                  >
                    <p className="font-ui text-[10px] text-ink-soft uppercase tracking-[0.16em] mb-1">
                      {stat.label}
                    </p>
                    <p className="font-expand text-xl text-ink leading-none">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Per-puzzle breakdown */}
              <div className="w-full mb-6 max-h-44 overflow-y-auto rounded-2xl border border-tile-edge bg-surface/50 divide-y divide-paper-line/30">
                {perPuzzleRef.current.map((stat, i) => {
                  const stars = perPuzzleStars[i];
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3.5 py-2"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-ui text-xs text-ink-soft uppercase tracking-wider">
                          {(i + 1).toString().padStart(2, "0")}
                        </span>
                        <span className="font-clue text-sm text-ink-muted">
                          {stat.attempts} {stat.attempts === 1 ? "guess" : "guesses"}
                          {stat.hints > 0 && (
                            <>, {stat.hints} hint{stat.hints === 1 ? "" : "s"}</>
                          )}
                          <span className="text-ink-soft/60">
                            {" "}
                            · {formatDuration(stat.durationMs)}
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3].map((n) => (
                          <span
                            key={n}
                            className="material-icons text-[16px]"
                            style={{
                              color:
                                n <= stars
                                  ? "var(--color-accent)"
                                  : "var(--color-tile-edge)",
                            }}
                          >
                            {n <= stars ? "star" : "star_outline"}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={startNewSession}
                className="w-full font-ui flex items-center justify-center gap-2 bg-ink hover:bg-ink/85 text-surface py-3.5 rounded-full text-base shadow-tile transition-all active:scale-95"
              >
                Play another session
                <span className="material-icons text-[20px]">refresh</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Judge modal — pauses for a beat then reveals correct/incorrect */}
      <AnimatePresence>
        {checkState !== "idle" && (
          <motion.div
            key="check-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center px-6"
          >
            <motion.div
              key={`check-card-${checkState}`}
              initial={{ scale: 0.9, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="relative bg-tile-face border border-tile-edge rounded-3xl px-10 py-8 shadow-[0_20px_60px_rgba(60,40,10,0.25)] flex flex-col items-center gap-3 min-w-[16rem]"
            >
              <div
                className="absolute inset-0 rounded-3xl pointer-events-none opacity-50"
                style={{ background: "var(--paper-tex)" }}
              />
              {checkState === "judging" && (
                <div className="relative flex flex-col items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1.1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center shadow-tile"
                  >
                    <span className="material-icons text-[30px]">search</span>
                  </motion.div>
                  <p className="font-ui text-sm text-ink-muted uppercase tracking-[0.2em]">
                    Judging…
                  </p>
                </div>
              )}
              {checkState === "incorrect" && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    x: [0, -8, 8, -5, 5, 0],
                  }}
                  transition={{
                    scale: { type: "spring", stiffness: 360, damping: 16 },
                    opacity: { duration: 0.2 },
                    x: { duration: 0.45, delay: 0.12, ease: "easeInOut" },
                  }}
                  className="relative flex flex-col items-center gap-2"
                >
                  <div className="w-14 h-14 rounded-full bg-warn/15 text-warn flex items-center justify-center shadow-tile-lift">
                    <span className="material-icons text-[34px]">close</span>
                  </div>
                  <p className="font-wide text-2xl text-ink">Not yet</p>
                  <p className="font-ui text-xs text-ink-soft">
                    Have another look.
                  </p>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
