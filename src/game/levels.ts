import type { Level } from "./types";
import { getExpectedEdges, isLevelSolved } from "./transforms";

/**
 * Level-selection algorithms. This module deliberately owns NO puzzle data —
 * each edition supplies its own library via `EditionConfig.levels`, and every
 * function here takes the pool it should draw from. That keeps the two
 * editions from ever sharing or leaking puzzles into each other.
 */

/**
 * Dev-only integrity audit: asserts every level has exactly one assemblable,
 * solvable configuration. Broken data should scream in the console rather
 * than surface as an unsolvable puzzle mid-session.
 */
export const auditLevels = (levels: Level[], label: string): void => {
  for (const level of levels) {
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
      console.error(`[${label}] Level ${level.id} solution can't be assembled from its tiles`, level);
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
        `[${label}] Level ${level.id} expected solution does not satisfy isLevelSolved — expected edges`,
        expected
      );
    }
  }
};

const shuffle = <T,>(arr: T[]): T[] => arr.slice().sort(() => Math.random() - 0.5);

const pickOne = <T,>(arr: T[], rejectIds?: Set<number>): T | undefined => {
  const candidates = rejectIds
    ? arr.filter((item: any) => !rejectIds.has(item.id))
    : arr;
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(Math.random() * candidates.length)];
};

/**
 * Builds a difficulty-escalating session from `pool`. By default the curve is:
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
export const pickSessionLevels = (pool: Level[], count: number = 5): Level[] => {
  const tier1 = pool.filter((l) => (l.tier ?? 1) === 1);
  const tier2 = pool.filter((l) => l.tier === 2);
  const tier3 = pool.filter((l) => l.tier === 3);
  const tier3Rotated = tier3.filter((l) => l.requiresRotation);
  const tier3Flat = tier3.filter((l) => !l.requiresRotation);

  const picked: Level[] = [];
  const used = new Set<number>();

  const take = (candidates: Level[]) => {
    const choice = pickOne(candidates, used);
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
        : pool.filter((l) => l.requiresRotation)
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
    for (const lvl of shuffle(pool)) {
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
export const pickLevels = (
  pool: Level[],
  count: number,
  startTier?: 1 | 2 | 3
): Level[] => {
  if (!startTier) return pickSessionLevels(pool, count);
  const filtered = pool.filter((l) => (l.tier ?? 1) >= startTier);
  return shuffle(filtered).slice(0, count);
};

/** 32-bit FNV-1a hash of a string — used as the seed for the daily RNG. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5 | 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Mulberry32 — small, deterministic, well-distributed PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Same tier curve as pickSessionLevels, but every random call is seeded so the
 * output is deterministic for a given seed string. Used by the daily scheduler.
 *
 * `pool` is the date-gated subset for the edition, so that levels added AFTER
 * launch never rewrite the sessions of days players have already played
 * (see daily/schedule.ts).
 */
export const pickSessionLevelsSeeded = (
  seedStr: string,
  count: number = 5,
  pool: Level[] = []
): Level[] => {
  const rand = mulberry32(fnv1a(seedStr))
  const seededPickOne = <T extends { id: number }>(arr: T[], reject: Set<number>): T | undefined => {
    const candidates = arr.filter((item) => !reject.has(item.id))
    if (candidates.length === 0) return undefined
    return candidates[Math.floor(rand() * candidates.length)]
  }
  const seededShuffle = <T,>(arr: T[]): T[] => {
    const out = arr.slice()
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }

  const tier1 = pool.filter((l) => (l.tier ?? 1) === 1)
  const tier2 = pool.filter((l) => l.tier === 2)
  const tier3 = pool.filter((l) => l.tier === 3)
  const tier3Rotated = tier3.filter((l) => l.requiresRotation)
  const tier3Flat = tier3.filter((l) => !l.requiresRotation)

  const picked: Level[] = []
  const used = new Set<number>()
  const take = (candidates: Level[]) => {
    const c = seededPickOne(candidates, used)
    if (c) {
      picked.push(c)
      used.add(c.id)
    }
    return c
  }

  if (count >= 5) {
    take(tier1)
    take(tier1)
    take(tier2)
    const bridgePool = [...tier2, ...tier3Flat]
    take(bridgePool.length > 0 ? bridgePool : tier1)
    take(tier3Rotated.length > 0 ? tier3Rotated : pool.filter((l) => l.requiresRotation))
    while (picked.length < count) {
      const extra = take(seededShuffle([...tier3, ...tier2]))
      if (!extra) break
    }
  } else {
    const pools = [tier1, tier1, tier2, tier2, tier3Rotated.length ? tier3Rotated : tier3]
    for (let i = 0; i < count; i++) take(pools[Math.min(i, pools.length - 1)])
  }

  if (picked.length < count) {
    for (const lvl of seededShuffle(pool)) {
      if (picked.length >= count) break
      if (!used.has(lvl.id)) {
        picked.push(lvl)
        used.add(lvl.id)
      }
    }
  }

  return picked.slice(0, count)
}
