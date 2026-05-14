import type { Level } from "./types";
import { getExpectedEdges, isLevelSolved } from "./transforms";
import levelsJson from "../../levels_generated.json";

/**
 * The loaded puzzle library. In dev, we run a runtime audit that asserts
 * every level has exactly one valid solved configuration — if a level slips
 * through with broken data we want to know in the browser console immediately.
 */
const RAW: Level[] = levelsJson as Level[];

if (typeof window !== "undefined" && import.meta.env.DEV) {
  for (const level of RAW) {
    const expected = getExpectedEdges(level);
    // Sanity: the level's expected solution is actually solvable with the
    // tiles it ships with — i.e. each slot has a tile (possibly flipped) that
    // can produce the solution.
    const slotsSolved = (
      [
        [level.solution.slot0Top, level.solution.slot0Bottom],
        [level.solution.slot1Top, level.solution.slot1Bottom],
      ] as const
    ).map(([top, bottom]) =>
      level.tiles.some(
        (t) => (t.top === top && t.bottom === bottom) || (t.top === bottom && t.bottom === top)
      )
    );
    if (!slotsSolved[0] || !slotsSolved[1]) {
      // eslint-disable-next-line no-console
      console.error(`[FlipWords] Level ${level.id} solution can't be assembled from its tiles`, level);
    }
    // Verify the solution placed at storage with the required rotation actually solves the level
    const placedSlots: [
      { id: string; top: string; bottom: string; isFlipped: boolean },
      { id: string; top: string; bottom: string; isFlipped: boolean }
    ] = [
      {
        id: "_s0",
        top: level.solution.slot0Top,
        bottom: level.solution.slot0Bottom,
        isFlipped: false,
      },
      {
        id: "_s1",
        top: level.solution.slot1Top,
        bottom: level.solution.slot1Bottom,
        isFlipped: false,
      },
    ];
    const rotation = level.requiresRotation ? 90 : 0;
    if (!isLevelSolved(placedSlots, rotation, level)) {
      // eslint-disable-next-line no-console
      console.error(
        `[FlipWords] Level ${level.id} expected solution does not satisfy isLevelSolved — expected edges`,
        expected
      );
    }
  }
}

export const allLevels: Level[] = RAW;

/** Pick a session set (preserves curve ordering). */
export const pickLevels = (count: number, startTier?: 1 | 2 | 3): Level[] => {
  const pool = startTier
    ? RAW.filter((l) => (l.tier ?? 1) >= startTier)
    : RAW.slice();
  return pool.slice(0, count);
};

/** Pick a randomized session, but biased toward easier puzzles up front. */
export const pickSessionLevels = (count: number): Level[] => {
  const tier1 = RAW.filter((l) => (l.tier ?? 1) === 1);
  const tier2 = RAW.filter((l) => l.tier === 2);
  const tier3 = RAW.filter((l) => l.tier === 3);
  const shuffle = <T,>(arr: T[]): T[] => arr.slice().sort(() => Math.random() - 0.5);
  const easy = shuffle(tier1);
  const mid = shuffle(tier2);
  const hard = shuffle(tier3);
  return [...easy, ...mid, ...hard].slice(0, count);
};
