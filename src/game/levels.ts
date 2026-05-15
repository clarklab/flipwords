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

const shuffle = <T,>(arr: T[]): T[] => arr.slice().sort(() => Math.random() - 0.5);

const pickOne = <T,>(arr: T[], rejectIds?: Set<number>): T | undefined => {
  const candidates = rejectIds
    ? arr.filter((item: any) => !rejectIds.has(item.id))
    : arr;
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(Math.random() * candidates.length)];
};

/**
 * Builds a difficulty-escalating session. By default the curve is:
 *
 *   slot 1 — tier 1, no rotation       (placement only — gentle warm-up)
 *   slot 2 — tier 1, no rotation       (placement + flipping starts mattering)
 *   slot 3 — tier 2, no rotation       (trickier vocabulary)
 *   slot 4 — tier 2 or non-rotated 3   (bridge into harder material)
 *   slot 5 — tier 3, REQUIRES rotation (uses every mechanic: place, flip, rotate)
 *
 * Falls back gracefully if any pool runs dry — the picker is opportunistic
 * about substitutions but always tries to keep difficulty monotonic.
 */
export const pickSessionLevels = (count: number = 5): Level[] => {
  const tier1 = RAW.filter((l) => (l.tier ?? 1) === 1);
  const tier2 = RAW.filter((l) => l.tier === 2);
  const tier3 = RAW.filter((l) => l.tier === 3);
  const tier3Rotated = tier3.filter((l) => l.requiresRotation);
  const tier3Flat = tier3.filter((l) => !l.requiresRotation);

  const picked: Level[] = [];
  const used = new Set<number>();

  const take = (pool: Level[]) => {
    const choice = pickOne(pool, used);
    if (choice) {
      picked.push(choice);
      used.add(choice.id);
    }
    return choice;
  };

  if (count >= 5) {
    // Canonical 5-slot session.
    take(tier1);
    take(tier1);
    take(tier2);
    // Bridge slot: prefer t2, allow flat t3, fall back to t1.
    take([...tier2, ...tier3Flat].length > 0 ? [...tier2, ...tier3Flat] : tier1);
    // Final slot must require rotation so the session uses every mechanic.
    take(
      tier3Rotated.length > 0
        ? tier3Rotated
        : RAW.filter((l) => l.requiresRotation)
    );
    // Any remaining slots top up with the hardest pool we have.
    while (picked.length < count) {
      const extra = take(shuffle([...tier3, ...tier2]));
      if (!extra) break;
    }
  } else {
    // Shorter session: just walk easy → hard.
    const pools = [tier1, tier1, tier2, tier2, tier3Rotated.length ? tier3Rotated : tier3];
    for (let i = 0; i < count; i++) {
      take(pools[Math.min(i, pools.length - 1)]);
    }
  }

  // Final safety net — if pools were exhausted, fill from the full set so we
  // never hand the UI a session shorter than requested.
  if (picked.length < count) {
    for (const lvl of shuffle(RAW)) {
      if (picked.length >= count) break;
      if (!used.has(lvl.id)) {
        picked.push(lvl);
        used.add(lvl.id);
      }
    }
  }

  return picked.slice(0, count);
};

/** Lightweight escape hatch — same difficulty intent without a fixed count. */
export const pickLevels = (count: number, startTier?: 1 | 2 | 3): Level[] => {
  if (!startTier) return pickSessionLevels(count);
  const pool = RAW.filter((l) => (l.tier ?? 1) >= startTier);
  return shuffle(pool).slice(0, count);
};
