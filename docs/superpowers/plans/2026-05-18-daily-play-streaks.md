# Daily Play, Streaks, and Archive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily-puzzle mode to FlipWords: deterministic same-puzzle-for-everyone schedule on US Eastern day boundary, a streak that ticks on session completion, a shareable post-session scorecard, and a browsable archive of past sessions for replay.

**Architecture:** Additive. The game internals (`FlipWords.tsx`, `transforms.ts`, `hint.ts`, `Tile.tsx`) keep their current shape. We add a `src/daily/` state layer (date math, seeded picker, localStorage CRUD, streak state machine, share string), refactor `FlipWords` to accept its session as a prop, extract a `<Scorecard>` component, and add new screens (`TitleScreen`, `Archive`) wired through new TanStack Router routes (`/play`, `/archive`, `/archive/$date`).

**Tech Stack:** TanStack Start (file-based routing) · React 19 · TypeScript strict · Tailwind 4 · Framer Motion · GSAP · `Intl.DateTimeFormat` for timezone math · localStorage for persistence · Vitest (new) for unit tests.

**Spec:** [docs/superpowers/specs/2026-05-18-daily-play-streaks-design.md](../specs/2026-05-18-daily-play-streaks-design.md)

---

## File Map

**New files (in dependency order):**

| Path | Responsibility |
|---|---|
| `src/daily/types.ts` | `EasternDate`, `SessionResult`, `StreakState`, `DailyStorage`, `SessionMode` |
| `src/daily/date.ts` | `easternDateString`, `dayNumber`, `msUntilNextRollover`, `shiftDate`, `LAUNCH_DATE` |
| `src/daily/schedule.ts` | `getSessionForDate(date)` — deterministic seeded picker |
| `src/daily/storage.ts` | `loadStorage`, `saveStorage`, `freshStorage`, `STORAGE_KEY` |
| `src/daily/streak.ts` | `tickStreak`, `settleStreak`, `recordCompletion` |
| `src/daily/share.ts` | `formatShareString`, `shareSession` |
| `src/components/Scorecard.tsx` | Extracted from `FlipWords.tsx`; renders the session-complete modal |
| `src/components/TitleScreen.tsx` | `/` landing screen |
| `src/components/Archive.tsx` | `/archive` month calendar + detail sheet |
| `src/routes/play.tsx` | Today's session — either game or scorecard |
| `src/routes/archive.tsx` | Calendar listing |
| `src/routes/archive.$date.tsx` | Replay past session |
| `tests/daily/date.test.ts` | Date helper tests |
| `tests/daily/schedule.test.ts` | Determinism + tier curve tests |
| `tests/daily/storage.test.ts` | localStorage round-trip + version guard |
| `tests/daily/streak.test.ts` | Streak state-machine tests |
| `tests/daily/share.test.ts` | Share string format tests |
| `vitest.config.ts` | Vitest config (extends vite.config.ts) |

**Modified files:**

| Path | Why |
|---|---|
| `package.json` | Add vitest, @vitest/ui, jsdom, scripts |
| `src/components/FlipWords.tsx` | Accept `{ mode, session, onComplete, alreadySolved? }` props; remove session-bootstrap and Scorecard rendering |
| `src/routes/index.tsx` | Render `<TitleScreen>` instead of `<FlipWords>` |
| `src/game/levels.ts` | Add seeded variant of `pickSessionLevels` |

---

## Task 1: Add Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Create: `tests/smoke.test.ts`

- [ ] **Step 1: Install Vitest and dependencies**

```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

Expected: packages added to `devDependencies`.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
})
```

- [ ] **Step 3: Add test scripts to `package.json`**

Edit `package.json` "scripts":

```json
{
  "scripts": {
    "dev": "vite dev --port 3000",
    "build": "rimraf dist && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Write a sanity smoke test**

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('arithmetic is sane', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/smoke.test.ts
git commit -m "Add Vitest + jsdom and a smoke test"
```

---

## Task 2: Daily types

**Files:**
- Create: `src/daily/types.ts`

- [ ] **Step 1: Write the types file**

Create `src/daily/types.ts`:

```ts
/** Eastern date string in YYYY-MM-DD form. */
export type EasternDate = string

export type SessionMode = 'daily' | 'archive' | 'practice'

export type PuzzleResult = {
  attempts: number
  hints: number
  durationMs: number
  stars: 1 | 2 | 3
}

export type SessionResult = {
  date: EasternDate
  dayNumber: number
  completedAt: number
  stars: 1 | 2 | 3
  perPuzzle: PuzzleResult[]
  totalDurationMs: number
}

export type StreakState = {
  current: number
  best: number
  lastCompletedDate: EasternDate | null
}

export type StoredSession = Omit<SessionResult, 'date' | 'dayNumber'> & {
  isDailyResult: true
}

export type DailyStorage = {
  schemaVersion: 1
  streak: StreakState
  sessions: { [date: EasternDate]: StoredSession }
  totals: {
    sessionsPlayed: number
    perfectSessions: number
  }
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/daily/types.ts
git commit -m "Add daily-play shared types"
```

---

## Task 3: Date helpers — `easternDateString`

**Files:**
- Create: `src/daily/date.ts`
- Create: `tests/daily/date.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/daily/date.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { easternDateString } from '@/daily/date'

describe('easternDateString', () => {
  it('returns YYYY-MM-DD format', () => {
    const d = new Date('2026-05-18T18:00:00Z') // 2pm Eastern
    expect(easternDateString(d)).toBe('2026-05-18')
  })

  it('rolls over at Eastern midnight, not UTC', () => {
    // 03:30 UTC = 23:30 Eastern (previous day) on May 18
    expect(easternDateString(new Date('2026-05-19T03:30:00Z'))).toBe('2026-05-18')
    // 05:00 UTC = 01:00 Eastern (next day)
    expect(easternDateString(new Date('2026-05-19T05:00:00Z'))).toBe('2026-05-19')
  })

  it('handles DST — uses EST in winter, EDT in summer', () => {
    // Jan 15 2026 03:30 UTC = Jan 14 22:30 EST
    expect(easternDateString(new Date('2026-01-15T03:30:00Z'))).toBe('2026-01-14')
    // Jul 15 2026 03:30 UTC = Jul 14 23:30 EDT
    expect(easternDateString(new Date('2026-07-15T03:30:00Z'))).toBe('2026-07-14')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- date`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `easternDateString`**

Create `src/daily/date.ts`:

```ts
import type { EasternDate } from './types'

/**
 * The first day the daily feature is live. Day 1 of the puzzle numbering.
 * Set right before shipping. Until shipped, leave at the planned launch date.
 */
export const LAUNCH_DATE: EasternDate = '2026-05-19'

const FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Eastern-time calendar date (YYYY-MM-DD) at the given instant. */
export function easternDateString(now: Date = new Date()): EasternDate {
  return FORMATTER.format(now)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- date`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/daily/date.ts tests/daily/date.test.ts
git commit -m "Add easternDateString date helper"
```

---

## Task 4: Date helpers — `dayNumber` and `shiftDate`

**Files:**
- Modify: `src/daily/date.ts`
- Modify: `tests/daily/date.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/daily/date.test.ts`:

```ts
import { dayNumber, shiftDate, LAUNCH_DATE } from '@/daily/date'

describe('dayNumber', () => {
  it('launch date is day 1', () => {
    expect(dayNumber(LAUNCH_DATE)).toBe(1)
  })

  it('one day after launch is day 2', () => {
    // LAUNCH_DATE is '2026-05-19' — day 2 is '2026-05-20'
    expect(dayNumber('2026-05-20')).toBe(2)
  })

  it('returns 0 or negative for pre-launch dates', () => {
    expect(dayNumber('2026-05-18')).toBe(0)
    expect(dayNumber('2026-05-17')).toBe(-1)
  })

  it('handles month and year boundaries', () => {
    // 13 days after May 19 = June 1 → day 14
    expect(dayNumber('2026-06-01')).toBe(14)
  })
})

describe('shiftDate', () => {
  it('shifts forward by N days', () => {
    expect(shiftDate('2026-05-18', 1)).toBe('2026-05-19')
    expect(shiftDate('2026-05-31', 1)).toBe('2026-06-01')
  })

  it('shifts backward by N days', () => {
    expect(shiftDate('2026-05-01', -1)).toBe('2026-04-30')
  })

  it('handles year boundaries', () => {
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

Run: `npm test -- date`
Expected: 7 failures (the new tests).

- [ ] **Step 3: Add implementations**

Append to `src/daily/date.ts`:

```ts
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Parse a YYYY-MM-DD date string as a UTC date at midnight. */
function parseDate(date: EasternDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Number of days since LAUNCH_DATE (inclusive). Launch day = 1. */
export function dayNumber(date: EasternDate): number {
  const diff = parseDate(date).getTime() - parseDate(LAUNCH_DATE).getTime()
  return Math.round(diff / MS_PER_DAY) + 1
}

/** Shift a date string forward/backward by `days` and return YYYY-MM-DD. */
export function shiftDate(date: EasternDate, days: number): EasternDate {
  const t = parseDate(date).getTime() + days * MS_PER_DAY
  const d = new Date(t)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
```

- [ ] **Step 4: Run tests — all pass**

Run: `npm test -- date`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/daily/date.ts tests/daily/date.test.ts
git commit -m "Add dayNumber and shiftDate"
```

---

## Task 5: Date helpers — `msUntilNextRollover`

**Files:**
- Modify: `src/daily/date.ts`
- Modify: `tests/daily/date.test.ts`

- [ ] **Step 1: Add failing test**

Append to `tests/daily/date.test.ts`:

```ts
import { msUntilNextRollover } from '@/daily/date'

describe('msUntilNextRollover', () => {
  it('returns ms until the next Eastern midnight', () => {
    // 14:00 UTC on May 18 = 10:00 AM EDT. Next midnight is 04:00 UTC May 19
    // (14 hours later).
    const now = new Date('2026-05-18T14:00:00Z')
    const ms = msUntilNextRollover(now)
    expect(ms).toBe(14 * 60 * 60 * 1000)
  })

  it('returns ~24h just past midnight', () => {
    // 04:00:01 UTC May 19 = 00:00:01 EDT
    const now = new Date('2026-05-19T04:00:01Z')
    const ms = msUntilNextRollover(now)
    // Should be ~24h minus 1s
    expect(ms).toBeGreaterThan(24 * 60 * 60 * 1000 - 5000)
    expect(ms).toBeLessThan(24 * 60 * 60 * 1000)
  })
})
```

- [ ] **Step 2: Run — verify fail**

Run: `npm test -- date`
Expected: 2 new failures.

- [ ] **Step 3: Implement**

Append to `src/daily/date.ts`:

```ts
/**
 * Milliseconds until the next Eastern-midnight rollover. Uses Intl.DateTimeFormat
 * to read the current Eastern HMS, then subtracts from 24h. DST-safe because
 * Intl handles the offset internally.
 */
export function msUntilNextRollover(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const hour = get('hour') % 24 // 'en-US' may emit "24" at midnight; normalize
  const min = get('minute')
  const sec = get('second')
  const elapsed = ((hour * 60) + min) * 60 + sec
  const remaining = 24 * 60 * 60 - elapsed
  return remaining * 1000 - (now.getTime() % 1000)
}
```

- [ ] **Step 4: Run — all pass**

Run: `npm test -- date`
Expected: 12 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/daily/date.ts tests/daily/date.test.ts
git commit -m "Add msUntilNextRollover"
```

---

## Task 6: Seeded daily picker

**Files:**
- Modify: `src/game/levels.ts`
- Create: `src/daily/schedule.ts`
- Create: `tests/daily/schedule.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/daily/schedule.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getSessionForDate } from '@/daily/schedule'

describe('getSessionForDate', () => {
  it('returns 5 levels', () => {
    expect(getSessionForDate('2026-05-19')).toHaveLength(5)
  })

  it('is deterministic — same date returns the same sequence', () => {
    const a = getSessionForDate('2026-05-19').map((l) => l.id)
    const b = getSessionForDate('2026-05-19').map((l) => l.id)
    expect(a).toEqual(b)
  })

  it('different dates return different sequences (high probability)', () => {
    const a = getSessionForDate('2026-05-19').map((l) => l.id).join(',')
    const b = getSessionForDate('2026-05-20').map((l) => l.id).join(',')
    expect(a).not.toBe(b)
  })

  it('preserves the tier curve — last level requires rotation', () => {
    const session = getSessionForDate('2026-05-19')
    expect(session[4].requiresRotation).toBe(true)
  })

  it('preserves the tier curve — first two levels are tier 1', () => {
    const session = getSessionForDate('2026-05-19')
    expect(session[0].tier ?? 1).toBe(1)
    expect(session[1].tier ?? 1).toBe(1)
  })

  it('every produced session is solvable by its declared solution', () => {
    // Sample 20 dates across the calendar
    for (let i = 0; i < 20; i++) {
      const session = getSessionForDate(`2026-05-${String(19 + i).padStart(2, '0')}`)
      for (const lvl of session) {
        const has = lvl.tiles.some(
          (t) =>
            (t.top === lvl.solution.slot0Top && t.bottom === lvl.solution.slot0Bottom) ||
            (t.top === lvl.solution.slot0Bottom && t.bottom === lvl.solution.slot0Top)
        )
        expect(has, `Level ${lvl.id} slot0 has no matching tile`).toBe(true)
      }
    }
  })
})
```

- [ ] **Step 2: Add a seeded picker variant to `src/game/levels.ts`**

Append to `src/game/levels.ts` (after the existing `pickLevels` export):

```ts
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
 */
export const pickSessionLevelsSeeded = (
  seedStr: string,
  count: number = 5
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

  const tier1 = RAW.filter((l) => (l.tier ?? 1) === 1)
  const tier2 = RAW.filter((l) => l.tier === 2)
  const tier3 = RAW.filter((l) => l.tier === 3)
  const tier3Rotated = tier3.filter((l) => l.requiresRotation)
  const tier3Flat = tier3.filter((l) => !l.requiresRotation)

  const picked: Level[] = []
  const used = new Set<number>()
  const take = (pool: Level[]) => {
    const c = seededPickOne(pool, used)
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
    take(tier3Rotated.length > 0 ? tier3Rotated : RAW.filter((l) => l.requiresRotation))
    while (picked.length < count) {
      const extra = take(seededShuffle([...tier3, ...tier2]))
      if (!extra) break
    }
  } else {
    const pools = [tier1, tier1, tier2, tier2, tier3Rotated.length ? tier3Rotated : tier3]
    for (let i = 0; i < count; i++) take(pools[Math.min(i, pools.length - 1)])
  }

  if (picked.length < count) {
    for (const lvl of seededShuffle(RAW)) {
      if (picked.length >= count) break
      if (!used.has(lvl.id)) {
        picked.push(lvl)
        used.add(lvl.id)
      }
    }
  }

  return picked.slice(0, count)
}
```

- [ ] **Step 3: Implement `schedule.ts`**

Create `src/daily/schedule.ts`:

```ts
import { pickSessionLevelsSeeded } from '@/game/levels'
import type { Level } from '@/game/types'
import type { EasternDate } from './types'

/**
 * Today's (or any past day's) 5-puzzle session. Deterministic for the given
 * date string — same date returns the same sequence, identically ordered.
 */
export function getSessionForDate(date: EasternDate): Level[] {
  return pickSessionLevelsSeeded(`flipwords:${date}`, 5)
}
```

- [ ] **Step 4: Run — all pass**

Run: `npm test -- schedule`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/levels.ts src/daily/schedule.ts tests/daily/schedule.test.ts
git commit -m "Add deterministic seeded daily picker"
```

---

## Task 7: localStorage persistence

**Files:**
- Create: `src/daily/storage.ts`
- Create: `tests/daily/storage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/daily/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { loadStorage, saveStorage, freshStorage, STORAGE_KEY } from '@/daily/storage'

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('freshStorage returns a valid empty shape', () => {
    const s = freshStorage()
    expect(s.schemaVersion).toBe(1)
    expect(s.streak).toEqual({ current: 0, best: 0, lastCompletedDate: null })
    expect(s.sessions).toEqual({})
    expect(s.totals).toEqual({ sessionsPlayed: 0, perfectSessions: 0 })
  })

  it('loadStorage returns fresh state when no key set', () => {
    const s = loadStorage()
    expect(s).toEqual(freshStorage())
  })

  it('saveStorage + loadStorage round-trip', () => {
    const s = freshStorage()
    s.streak.current = 3
    s.streak.best = 5
    s.streak.lastCompletedDate = '2026-05-19'
    saveStorage(s)
    expect(loadStorage()).toEqual(s)
  })

  it('loadStorage returns fresh state on corrupt JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json{')
    expect(loadStorage()).toEqual(freshStorage())
  })

  it('loadStorage returns fresh state on wrong schemaVersion', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }))
    expect(loadStorage()).toEqual(freshStorage())
  })
})
```

- [ ] **Step 2: Run — verify failure**

Run: `npm test -- storage`
Expected: fail (module not found).

- [ ] **Step 3: Implement**

Create `src/daily/storage.ts`:

```ts
import type { DailyStorage } from './types'

export const STORAGE_KEY = 'flipwords_daily_v1'

export function freshStorage(): DailyStorage {
  return {
    schemaVersion: 1,
    streak: { current: 0, best: 0, lastCompletedDate: null },
    sessions: {},
    totals: { sessionsPlayed: 0, perfectSessions: 0 },
  }
}

export function loadStorage(): DailyStorage {
  if (typeof window === 'undefined') return freshStorage()
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return freshStorage()
  try {
    const parsed = JSON.parse(raw) as Partial<DailyStorage>
    if (parsed?.schemaVersion !== 1) return freshStorage()
    return {
      schemaVersion: 1,
      streak: parsed.streak ?? freshStorage().streak,
      sessions: parsed.sessions ?? {},
      totals: parsed.totals ?? freshStorage().totals,
    }
  } catch {
    return freshStorage()
  }
}

export function saveStorage(s: DailyStorage): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}
```

- [ ] **Step 4: Run — all pass**

Run: `npm test -- storage`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/daily/storage.ts tests/daily/storage.test.ts
git commit -m "Add localStorage CRUD for daily state"
```

---

## Task 8: Streak state machine

**Files:**
- Create: `src/daily/streak.ts`
- Create: `tests/daily/streak.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/daily/streak.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { tickStreak, settleStreak, recordCompletion } from '@/daily/streak'
import { freshStorage } from '@/daily/storage'
import type { SessionResult } from '@/daily/types'

const makeResult = (date: string, stars: 1 | 2 | 3 = 2): SessionResult => ({
  date,
  dayNumber: 1,
  completedAt: Date.now(),
  stars,
  perPuzzle: [
    { attempts: 1, hints: 0, durationMs: 60000, stars: 3 },
    { attempts: 1, hints: 0, durationMs: 60000, stars: 3 },
    { attempts: 2, hints: 0, durationMs: 60000, stars: 2 },
    { attempts: 2, hints: 0, durationMs: 60000, stars: 2 },
    { attempts: 1, hints: 0, durationMs: 60000, stars: 3 },
  ],
  totalDurationMs: 300000,
})

describe('tickStreak', () => {
  it('first-ever completion: current 0 → 1, best 0 → 1', () => {
    const s = tickStreak(freshStorage(), '2026-05-19')
    expect(s.streak).toEqual({ current: 1, best: 1, lastCompletedDate: '2026-05-19' })
  })

  it('consecutive days increment', () => {
    let s = tickStreak(freshStorage(), '2026-05-19')
    s = tickStreak(s, '2026-05-20')
    expect(s.streak.current).toBe(2)
    expect(s.streak.best).toBe(2)
    expect(s.streak.lastCompletedDate).toBe('2026-05-20')
  })

  it('non-consecutive day resets current to 1, keeps best', () => {
    let s = tickStreak(freshStorage(), '2026-05-19')
    s = tickStreak(s, '2026-05-20')
    s = tickStreak(s, '2026-05-21') // best = 3
    s = tickStreak(s, '2026-05-25') // skipped 22, 23, 24
    expect(s.streak.current).toBe(1)
    expect(s.streak.best).toBe(3)
  })

  it('replaying today is a no-op', () => {
    let s = tickStreak(freshStorage(), '2026-05-19')
    const before = { ...s.streak }
    s = tickStreak(s, '2026-05-19')
    expect(s.streak).toEqual(before)
  })
})

describe('settleStreak', () => {
  it('resets current to 0 when lastCompletedDate is older than yesterday', () => {
    let s = tickStreak(freshStorage(), '2026-05-19')
    s = settleStreak(s, '2026-05-25')
    expect(s.streak.current).toBe(0)
    expect(s.streak.best).toBe(1) // best preserved
    expect(s.streak.lastCompletedDate).toBe('2026-05-19')
  })

  it('does NOT reset when lastCompletedDate is yesterday', () => {
    let s = tickStreak(freshStorage(), '2026-05-19')
    s = settleStreak(s, '2026-05-20')
    expect(s.streak.current).toBe(1)
  })

  it('does NOT reset when lastCompletedDate is today', () => {
    let s = tickStreak(freshStorage(), '2026-05-19')
    s = settleStreak(s, '2026-05-19')
    expect(s.streak.current).toBe(1)
  })

  it('does nothing when lastCompletedDate is null', () => {
    const s = settleStreak(freshStorage(), '2026-05-19')
    expect(s.streak.current).toBe(0)
    expect(s.streak.lastCompletedDate).toBe(null)
  })
})

describe('recordCompletion', () => {
  it('stores a session, ticks streak, bumps sessionsPlayed', () => {
    const s = recordCompletion(freshStorage(), '2026-05-19', makeResult('2026-05-19', 2))
    expect(s.sessions['2026-05-19']).toBeDefined()
    expect(s.sessions['2026-05-19'].stars).toBe(2)
    expect(s.streak.current).toBe(1)
    expect(s.totals.sessionsPlayed).toBe(1)
    expect(s.totals.perfectSessions).toBe(0)
  })

  it('bumps perfectSessions on 3-star result', () => {
    const s = recordCompletion(freshStorage(), '2026-05-19', makeResult('2026-05-19', 3))
    expect(s.totals.perfectSessions).toBe(1)
  })

  it('is idempotent — replaying today does not overwrite', () => {
    let s = recordCompletion(freshStorage(), '2026-05-19', makeResult('2026-05-19', 2))
    const before = s.sessions['2026-05-19']
    s = recordCompletion(s, '2026-05-19', makeResult('2026-05-19', 3))
    expect(s.sessions['2026-05-19']).toBe(before)
    expect(s.totals.sessionsPlayed).toBe(1)
    expect(s.totals.perfectSessions).toBe(0) // not bumped on replay
  })
})
```

- [ ] **Step 2: Run — verify failure**

Run: `npm test -- streak`
Expected: fail.

- [ ] **Step 3: Implement**

Create `src/daily/streak.ts`:

```ts
import type { DailyStorage, SessionResult } from './types'
import { shiftDate } from './date'

export function tickStreak(s: DailyStorage, today: string): DailyStorage {
  const { lastCompletedDate, current, best } = s.streak
  if (lastCompletedDate === today) return s
  const consecutive = lastCompletedDate === shiftDate(today, -1)
  const nextCurrent = consecutive ? current + 1 : 1
  return {
    ...s,
    streak: {
      current: nextCurrent,
      best: Math.max(best, nextCurrent),
      lastCompletedDate: today,
    },
  }
}

export function settleStreak(s: DailyStorage, today: string): DailyStorage {
  const { lastCompletedDate, current } = s.streak
  if (lastCompletedDate === null) return s
  if (lastCompletedDate === today) return s
  if (lastCompletedDate === shiftDate(today, -1)) return s
  if (current === 0) return s
  return { ...s, streak: { ...s.streak, current: 0 } }
}

export function recordCompletion(
  s: DailyStorage,
  today: string,
  result: SessionResult
): DailyStorage {
  if (s.sessions[today]) return s // idempotent
  const ticked = tickStreak(s, today)
  return {
    ...ticked,
    sessions: {
      ...ticked.sessions,
      [today]: {
        completedAt: result.completedAt,
        stars: result.stars,
        perPuzzle: result.perPuzzle,
        totalDurationMs: result.totalDurationMs,
        isDailyResult: true,
      },
    },
    totals: {
      sessionsPlayed: ticked.totals.sessionsPlayed + 1,
      perfectSessions:
        ticked.totals.perfectSessions + (result.stars === 3 ? 1 : 0),
    },
  }
}
```

- [ ] **Step 4: Run — all pass**

Run: `npm test -- streak`
Expected: 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/daily/streak.ts tests/daily/streak.test.ts
git commit -m "Add streak state machine"
```

---

## Task 9: Share string

**Files:**
- Create: `src/daily/share.ts`
- Create: `tests/daily/share.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/daily/share.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatShareString } from '@/daily/share'

describe('formatShareString', () => {
  it('3-star session', () => {
    expect(
      formatShareString({ dayNumber: 42, stars: 3, totalDurationMs: 252_000 })
    ).toBe('FlipWords No. 042\n★★★ — 4:12\nflipwords.superfun.games')
  })

  it('2-star session', () => {
    expect(
      formatShareString({ dayNumber: 42, stars: 2, totalDurationMs: 348_000 })
    ).toBe('FlipWords No. 042\n★★☆ — 5:48\nflipwords.superfun.games')
  })

  it('1-star session', () => {
    expect(
      formatShareString({ dayNumber: 42, stars: 1, totalDurationMs: 570_000 })
    ).toBe('FlipWords No. 042\n★☆☆ — 9:30\nflipwords.superfun.games')
  })

  it('pads small numbers to 3 digits', () => {
    expect(
      formatShareString({ dayNumber: 7, stars: 3, totalDurationMs: 60_000 })
    ).toBe('FlipWords No. 007\n★★★ — 1:00\nflipwords.superfun.games')
  })

  it('does not pad large numbers', () => {
    expect(
      formatShareString({ dayNumber: 1234, stars: 3, totalDurationMs: 60_000 })
    ).toBe('FlipWords No. 1234\n★★★ — 1:00\nflipwords.superfun.games')
  })

  it('formats sub-minute times correctly', () => {
    expect(
      formatShareString({ dayNumber: 1, stars: 3, totalDurationMs: 5_000 })
    ).toBe('FlipWords No. 001\n★★★ — 0:05\nflipwords.superfun.games')
  })
})
```

- [ ] **Step 2: Run — verify failure**

Run: `npm test -- share`
Expected: fail.

- [ ] **Step 3: Implement**

Create `src/daily/share.ts`:

```ts
const SITE_URL = 'flipwords.superfun.games'

export type ShareInput = {
  dayNumber: number
  stars: 1 | 2 | 3
  totalDurationMs: number
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function padNumber(n: number): string {
  // 1–3 digits get zero-padded to 3; bigger numbers print as-is.
  return n < 1000 ? n.toString().padStart(3, '0') : n.toString()
}

function starString(stars: 1 | 2 | 3): string {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars)
}

export function formatShareString(input: ShareInput): string {
  return `FlipWords No. ${padNumber(input.dayNumber)}\n${starString(input.stars)} — ${formatTime(input.totalDurationMs)}\n${SITE_URL}`
}

/**
 * Share via the Web Share API if available, falling back to clipboard.
 * Returns the method used so the caller can show appropriate UI feedback.
 */
export async function shareSession(input: ShareInput): Promise<'native' | 'clipboard' | 'failed'> {
  const text = formatShareString(input)
  if (typeof navigator === 'undefined') return 'failed'
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'native'
    } catch {
      // User canceled or share rejected — fall through to clipboard.
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return 'clipboard'
    } catch {
      return 'failed'
    }
  }
  return 'failed'
}
```

- [ ] **Step 4: Run — all pass**

Run: `npm test -- share`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/daily/share.ts tests/daily/share.test.ts
git commit -m "Add share-string formatter and share entry point"
```

---

## Task 10: Extract `<Scorecard>` component (visual no-op)

The scorecard is currently rendered inline inside `FlipWords.tsx`. We extract its markup into a reusable component without changing the visible behavior. This sets up Task 11 (FlipWords becomes session-source-agnostic) and Task 12 (`<Scorecard>` gets a Share button).

**Files:**
- Create: `src/components/Scorecard.tsx`
- Modify: `src/components/FlipWords.tsx`

- [ ] **Step 1: Create `Scorecard.tsx` with the existing markup, exporting the props it needs**

Create `src/components/Scorecard.tsx`. Use the exact markup currently inside the `{showSessionSummary && (...)}` block of `FlipWords.tsx`, parameterized:

```tsx
import { motion, AnimatePresence } from 'framer-motion'

export type ScorecardStats = {
  attempts: number
  hints: number
  durationMs: number
  stars: 1 | 2 | 3
}

export type ScorecardProps = {
  open: boolean
  headline: string
  overallStars: 1 | 2 | 3
  totalStars: number
  possibleStars: number
  sessionDurationMs: number
  totalGuesses: number
  totalHints: number
  perPuzzle: ScorecardStats[]
  primaryLabel: string
  primaryIcon: string
  onPrimary: () => void
}

const formatDuration = (ms: number): string => {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Scorecard(props: ScorecardProps) {
  const {
    open,
    headline,
    overallStars,
    totalStars,
    possibleStars,
    sessionDurationMs,
    totalGuesses,
    totalHints,
    perPuzzle,
    primaryLabel,
    primaryIcon,
    onPrimary,
  } = props

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scorecard-backdrop"
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
            key="scorecard-card"
            initial={{ y: 20, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="bg-tile-face rounded-3xl w-full max-w-md p-6 md:p-8 shadow-tile-lift flex flex-col items-center"
          >
            <p className="font-ui text-[11px] text-ink-soft uppercase tracking-[0.22em] mb-3">
              Session complete
            </p>

            <div className="flex items-center gap-2 mb-4">
              {[1, 2, 3].map((n) => {
                const filled = n <= overallStars
                const delay = 0.2 + n * 0.15
                return (
                  <div
                    key={n}
                    className="relative inline-flex items-center justify-center w-[56px] h-[56px]"
                  >
                    {filled && (
                      <motion.span
                        aria-hidden
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: [0, 2.1, 2.4], opacity: [0, 0.85, 0] }}
                        transition={{ delay, duration: 0.65, times: [0, 0.35, 1], ease: 'easeOut' }}
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{
                          background:
                            'radial-gradient(circle, rgba(247,196,84,0.85) 0%, rgba(247,196,84,0.35) 38%, rgba(247,196,84,0) 70%)',
                          willChange: 'transform, opacity',
                        }}
                      />
                    )}
                    <motion.span
                      initial={{ scale: 0, rotate: -180, opacity: 0 }}
                      animate={
                        filled
                          ? {
                              scale: [0, 1.55, 0.85, 1.12, 1],
                              rotate: [-180, 25, -10, 5, 0],
                              opacity: [0, 1, 1, 1, 1],
                            }
                          : { scale: [0, 0.7, 1], rotate: [-90, 10, 0], opacity: [0, 1, 1] }
                      }
                      transition={{
                        delay,
                        duration: filled ? 0.75 : 0.5,
                        times: filled ? [0, 0.45, 0.68, 0.86, 1] : [0, 0.6, 1],
                        ease: 'easeOut',
                      }}
                      className="material-icons relative text-[44px] leading-none"
                      style={{
                        color: filled ? 'var(--color-accent)' : 'var(--color-tile-edge)',
                        filter: filled ? 'drop-shadow(0 4px 14px rgba(31,156,147,0.55))' : 'none',
                        fontVariationSettings: filled
                          ? '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 48'
                          : '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 48',
                        willChange: 'transform, opacity',
                      }}
                    >
                      star
                    </motion.span>
                  </div>
                )
              })}
            </div>

            <h2 className="font-wide text-2xl md:text-3xl text-ink text-center leading-tight mb-1">
              {headline}
            </h2>
            <p className="font-clue text-sm text-ink-muted text-center mb-5">
              {totalStars} of {possibleStars} stars across {perPuzzle.length} puzzles
            </p>

            <div className="w-full grid grid-cols-3 gap-2 mb-5">
              {[
                { label: 'Time', value: formatDuration(sessionDurationMs) },
                { label: 'Guesses', value: totalGuesses.toString() },
                { label: 'Hints', value: totalHints.toString() },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl bg-surface-deep/40 px-2 py-3 text-center shadow-slot-inset"
                >
                  <p className="font-ui text-[10px] text-ink-soft uppercase tracking-[0.16em] mb-1">
                    {stat.label}
                  </p>
                  <p className="font-expand text-xl text-ink leading-none">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="w-full mb-6 rounded-2xl border border-tile-edge bg-surface/50 divide-y divide-paper-line/30">
              {perPuzzle.map((stat, i) => (
                <div key={i} className="flex items-center justify-between px-3.5 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-ui text-xs text-ink-soft uppercase tracking-wider">
                      {(i + 1).toString().padStart(2, '0')}
                    </span>
                    <span className="font-clue text-sm text-ink-muted">
                      {stat.attempts} {stat.attempts === 1 ? 'guess' : 'guesses'}
                      {stat.hints > 0 && (
                        <>
                          , {stat.hints} hint{stat.hints === 1 ? '' : 's'}
                        </>
                      )}
                      <span className="text-ink-soft/60"> · {formatDuration(stat.durationMs)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3].map((n) => {
                      const isFilled = n <= stat.stars
                      return (
                        <span
                          key={n}
                          className="material-icons text-[16px]"
                          style={{
                            color: isFilled ? 'var(--color-accent)' : 'var(--color-tile-edge)',
                            fontVariationSettings: isFilled
                              ? '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 20'
                              : '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 20',
                          }}
                        >
                          star
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={onPrimary}
              className="w-full font-ui flex items-center justify-center gap-2 bg-ink hover:bg-ink/85 text-surface py-3.5 rounded-full text-base shadow-tile transition-all active:scale-95"
            >
              {primaryLabel}
              <span className="material-icons text-[20px]">{primaryIcon}</span>
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Wire `<Scorecard>` into FlipWords**

Open `src/components/FlipWords.tsx`. Replace the inline `<AnimatePresence>{showSessionSummary && (...)}<AnimatePresence>` block (the one that begins `key="scorecard-backdrop"`) with a single `<Scorecard>` invocation:

```tsx
import Scorecard from './Scorecard'
```

Replace the entire scorecard `<AnimatePresence>` block (around lines 1258–1451 in the current file) with:

```tsx
<Scorecard
  open={showSessionSummary}
  headline={sessionHeadline}
  overallStars={overallStars}
  totalStars={totalStars}
  possibleStars={possibleStars}
  sessionDurationMs={sessionDuration}
  totalGuesses={totalGuesses}
  totalHints={totalHints}
  perPuzzle={perPuzzleRef.current.map((p, i) => ({
    attempts: p.attempts,
    hints: p.hints,
    durationMs: p.durationMs,
    stars: perPuzzleStars[i],
  }))}
  primaryLabel="Play another session"
  primaryIcon="refresh"
  onPrimary={startNewSession}
/>
```

- [ ] **Step 3: Dev sanity check**

Run: `npm run dev`
Open: `http://localhost:3000`
Play one session through to completion.
Expected: scorecard appears identical to before; "Play another session" button works.

- [ ] **Step 4: Commit**

```bash
git add src/components/Scorecard.tsx src/components/FlipWords.tsx
git commit -m "Extract <Scorecard> component from FlipWords"
```

---

## Task 11: FlipWords accepts session as a prop

The current `FlipWords` always bootstraps with `pickSessionLevels(5)`. To support daily / archive / practice modes, it needs to receive its session and a completion callback as props.

**Files:**
- Modify: `src/components/FlipWords.tsx`

- [ ] **Step 1: Add the new props**

In `src/components/FlipWords.tsx`, change the default export signature from `export default function FlipWords()` to:

```tsx
import type { Level } from '@/game/types'

export type FlipWordsMode = 'daily' | 'archive' | 'practice'

export type FlipWordsProps = {
  /** The pre-built 5-puzzle session this run will play. */
  session: Level[]
  /** Identifies the persistence/CTA flavor. */
  mode: FlipWordsMode
  /**
   * Called once when the session is complete with the aggregated result.
   * The host page is responsible for persistence and navigation.
   */
  onComplete?: (result: import('@/daily/types').SessionResult) => void
  /**
   * Eastern date string this session belongs to. Used for the SessionResult.
   */
  date: import('@/daily/types').EasternDate
  /** Day number for this session (today's daily number, or archive's). */
  dayNumber: number
  /** Override the scorecard's primary CTA. */
  scorecardPrimaryLabel?: string
  scorecardPrimaryIcon?: string
  onScorecardPrimary?: () => void
}

export default function FlipWords(props: FlipWordsProps) {
  const { session, mode, onComplete, date, dayNumber,
          scorecardPrimaryLabel, scorecardPrimaryIcon, onScorecardPrimary } = props
  // ... existing body ...
}
```

- [ ] **Step 2: Replace `setGameLevels(pickSessionLevels(SESSION_SIZE))` calls**

Remove the `useEffect` that calls `setGameLevels(pickSessionLevels(SESSION_SIZE))` on mount. Replace state init so `gameLevels` is initialized from props:

```tsx
const [gameLevels, setGameLevels] = useState<Level[]>(session)
// add an effect to update if session prop changes (i.e. user starts a new run)
useEffect(() => {
  setGameLevels(session)
  setLevelIdx(0)
  setShowSessionSummary(false)
  sessionStartRef.current = null
  sessionEndRef.current = null
  perPuzzleRef.current = []
  elapsedAccumRef.current = 0
  visibleStartRef.current = null
  setElapsedMs(0)
}, [session])
```

- [ ] **Step 3: Remove `startNewSession` body, replace with prop callback**

`startNewSession` currently picks a fresh 5 levels. That decision now lives outside the component. Change `startNewSession` to defer to the prop:

```tsx
const startNewSession = () => {
  if (onScorecardPrimary) {
    onScorecardPrimary()
    return
  }
  // Practice-mode default: re-pick from prop. (Should rarely trigger — host pages set onScorecardPrimary.)
  setShowSessionSummary(false)
}
```

- [ ] **Step 4: Fire `onComplete` when the session summary surfaces**

In the existing `useEffect` that fires when `showSessionSummary` becomes true, add an `onComplete` invocation. Place it just after `playSessionComplete()`:

```tsx
useEffect(() => {
  if (!showSessionSummary) return
  playSessionComplete()
  // Fire onComplete with the aggregated result so the host can persist.
  if (onComplete && perPuzzleRef.current.length > 0) {
    const totalDurationMs =
      sessionEndRef.current && sessionStartRef.current
        ? sessionEndRef.current - sessionStartRef.current
        : 0
    const perPuzzleResults = perPuzzleRef.current.map((p) => ({
      attempts: p.attempts,
      hints: p.hints,
      durationMs: p.durationMs,
      stars: computeStars(p.attempts, p.durationMs),
    }))
    const totalStars = perPuzzleResults.reduce((s, p) => s + p.stars, 0)
    const possible = perPuzzleResults.length * 3
    const overall: 1 | 2 | 3 =
      totalStars === possible ? 3 : totalStars >= possible * (2 / 3) ? 2 : 1
    onComplete({
      date,
      dayNumber,
      completedAt: Date.now(),
      stars: overall,
      perPuzzle: perPuzzleResults,
      totalDurationMs,
    })
  }
  // ... existing star-sound timers ...
}, [showSessionSummary])
```

- [ ] **Step 5: Pass scorecard primary props to `<Scorecard>`**

In the `<Scorecard>` invocation, change the three primary props to come from props:

```tsx
<Scorecard
  // ...
  primaryLabel={scorecardPrimaryLabel ?? 'Play another session'}
  primaryIcon={scorecardPrimaryIcon ?? 'refresh'}
  onPrimary={onScorecardPrimary ?? startNewSession}
/>
```

- [ ] **Step 6: Drop the `pickSessionLevels` import and its `SESSION_SIZE` constant**

In `src/components/FlipWords.tsx`, remove `pickSessionLevels` from the import statement and delete the `const SESSION_SIZE = 5` line.

- [ ] **Step 7: Update `src/routes/index.tsx` to use new props (temporary — will be replaced in Task 13)**

For now, give the existing `Home` route a working session so the app still renders:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import FlipWords from '../components/FlipWords'
import { getSessionForDate } from '@/daily/schedule'
import { easternDateString, dayNumber } from '@/daily/date'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const today = easternDateString()
  const session = getSessionForDate(today)
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
      <FlipWords
        session={session}
        mode="daily"
        date={today}
        dayNumber={dayNumber(today)}
      />
    </div>
  )
}
```

- [ ] **Step 8: Dev sanity check + typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev` and play through one session.
Expected: game runs end-to-end with the deterministic daily session. Scorecard still appears; "Play another session" no longer does anything useful (that's expected — wiring lands in Task 13).

- [ ] **Step 9: Commit**

```bash
git add src/components/FlipWords.tsx src/routes/index.tsx
git commit -m "FlipWords accepts session, mode, and onComplete as props"
```

---

## Task 12: TitleScreen component

**Files:**
- Create: `src/components/TitleScreen.tsx`

- [ ] **Step 1: Implement TitleScreen**

Create `src/components/TitleScreen.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import AnimatedWordmark from './AnimatedWordmark'
import { easternDateString, dayNumber, msUntilNextRollover } from '@/daily/date'
import { loadStorage, saveStorage } from '@/daily/storage'
import { settleStreak } from '@/daily/streak'
import type { DailyStorage } from '@/daily/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function formatPuzzleNumber(n: number): string {
  return n < 1000 ? n.toString().padStart(3, '0') : n.toString()
}

function easternHeaderDate(today: string): string {
  // Parse YYYY-MM-DD as UTC midnight (timezone-agnostic, only used for the
  // weekday/month labels — no DST math involved).
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${WEEKDAYS[date.getUTCDay()]} · ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`
}

export default function TitleScreen() {
  const today = easternDateString()
  const dn = dayNumber(today)

  // Settle streak on mount so a missed-day reset shows immediately.
  const [storage, setStorage] = useState<DailyStorage | null>(null)
  useEffect(() => {
    const settled = settleStreak(loadStorage(), today)
    saveStorage(settled)
    setStorage(settled)
  }, [today])

  // Countdown ticker (60s cadence — good enough for `9h 37m`).
  const [countdown, setCountdown] = useState(msUntilNextRollover())
  useEffect(() => {
    const tick = () => setCountdown(msUntilNextRollover())
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const todaysSessionDone = !!storage?.sessions[today]
  const streak = storage?.streak.current ?? 0
  const sessionsPlayed = storage?.totals.sessionsPlayed ?? 0
  const perfectSessions = storage?.totals.perfectSessions ?? 0
  const avgStars = (() => {
    if (!storage || sessionsPlayed === 0) return null
    const total = Object.values(storage.sessions).reduce((s, r) => s + r.stars, 0)
    return (total / sessionsPlayed).toFixed(1)
  })()

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-chin overflow-hidden">
      {/* Cream play surface */}
      <div className="flex-1 min-h-0 mt-1.5 md:mt-2 flex flex-col bg-paper rounded-[28px] md:rounded-[36px] shadow-play-lift relative z-10 overflow-hidden">

        <header className="relative w-full max-w-3xl mx-auto px-4 pt-4 md:pt-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              className="w-11 h-11 rounded-full flex items-center justify-center font-ui bg-white border border-tile-edge text-ink-muted hover:text-ink hover:shadow-tile-hover transition-all active:scale-95 shadow-tile"
              title="Menu"
              aria-label="Menu"
            >
              <span className="material-icons text-[22px]">menu</span>
            </button>
            <button
              className="w-11 h-11 rounded-full flex items-center justify-center font-ui bg-white border border-tile-edge text-ink-muted hover:text-ink hover:shadow-tile-hover transition-all active:scale-95 shadow-tile"
              title="How to play"
              aria-label="How to play"
            >
              <span className="material-icons text-[20px]">help_outline</span>
            </button>
          </div>
          <div className="absolute inset-x-0 top-4 md:top-6 h-11 flex items-center justify-center pointer-events-none">
            <AnimatedWordmark className="text-xl md:text-2xl text-ink" />
          </div>
        </header>

        <p className="text-center font-ui text-[11px] text-ink-soft uppercase tracking-[0.2em] mt-3">
          Daily word puzzle
        </p>

        <div className="flex-1 min-h-0 w-full max-w-md mx-auto px-5 md:px-6 mt-5 flex flex-col">

          {/* Hero card */}
          <div className="bg-tile-face border border-tile-edge rounded-[26px] px-5 py-5 text-center shadow-tile-lift">
            <p className="font-ui text-[11px] text-ink-soft uppercase tracking-[0.2em] mb-2">
              {easternHeaderDate(today)}
            </p>
            <p className="font-wide text-[44px] md:text-[46px] text-ink leading-none tracking-[-0.01em]">
              No. {formatPuzzleNumber(dn)}
            </p>
            <p className="font-clue text-[13px] text-ink-muted mt-3 inline-flex items-center gap-1.5">
              <span className="material-icons text-[16px] text-ink-soft">view_carousel</span>
              5 puzzles · Tier 1 → 3
            </p>
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-3 mt-4 border border-tile-edge rounded-2xl bg-tile-face shadow-tile overflow-hidden">
            <StatCell
              tone="warm"
              icon="local_fire_department"
              filled
              value={streak === 0 ? '—' : streak.toString()}
              label="Streak"
            />
            <StatCell
              tone="gold"
              icon="star"
              filled
              value={avgStars ?? '—'}
              label="Avg ★"
            />
            <StatCell
              tone="accent"
              icon="grid_view"
              value={sessionsPlayed.toString()}
              label="Played"
            />
          </div>

          <div className="flex-1 min-h-4" />

          {/* Primary CTA */}
          <Link
            to="/play"
            className="font-ui flex items-center justify-center gap-2 bg-ink hover:bg-ink/85 text-surface px-7 py-4 rounded-full text-base shadow-tile transition-all active:scale-95"
          >
            {todaysSessionDone ? "View today's scorecard" : "Play today's session"}
            <span className="material-icons text-[20px]">
              {todaysSessionDone ? 'chevron_right' : 'arrow_forward'}
            </span>
          </Link>

          <div className="flex items-center justify-center mt-4 mb-3">
            <Link
              to="/archive"
              className="font-ui flex items-center gap-1.5 text-ink-muted hover:text-ink text-sm py-1.5"
            >
              <span className="material-icons text-[18px] text-ink-soft">history</span>
              Archive
            </Link>
          </div>
        </div>

        {/* Mention perfectSessions silently — not rendered, but available to V2 stats page */}
        {perfectSessions >= 0 && null}
      </div>

      {/* Chin */}
      <div
        className="flex-shrink-0 bg-chin text-surface relative"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="relative z-20 w-full max-w-3xl mx-auto px-5 md:px-7 pt-3 md:pt-4 pb-1 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="material-icons text-black/60"
              style={{ fontSize: 26, fontVariationSettings: '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 24' }}
              aria-hidden="true"
            >
              avg_pace
            </span>
            <span className="font-expand text-[22px] md:text-2xl leading-none tabular-nums tracking-[-0.01em] text-surface">
              {formatCountdown(countdown)}
            </span>
          </div>
          <span className="font-ui text-[11px] tracking-[0.2em] uppercase text-surface/85">
            Next puzzle
          </span>
        </div>
      </div>
    </div>
  )
}

function StatCell({
  tone,
  icon,
  value,
  label,
  filled,
}: {
  tone: 'warm' | 'gold' | 'accent'
  icon: string
  value: string
  label: string
  filled?: boolean
}) {
  const toneBg = tone === 'warm'
    ? 'bg-[oklch(94%_0.04_38)] text-[oklch(64%_0.16_38)]'
    : tone === 'gold'
    ? 'bg-[oklch(95%_0.06_90)] text-[oklch(58%_0.13_90)]'
    : 'bg-accent-soft text-accent'
  return (
    <div className="text-center py-3.5 border-l border-tile-edge first:border-l-0">
      <span
        className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded-full ${toneBg}`}
      >
        <span
          className="material-icons text-[18px]"
          style={filled ? { fontVariationSettings: '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 24' } : undefined}
        >
          {icon}
        </span>
      </span>
      <p className="font-expand text-[26px] text-ink leading-none mt-1.5">{value}</p>
      <p className="font-ui text-[10px] text-ink-soft uppercase tracking-[0.18em] mt-1.5">{label}</p>
    </div>
  )
}
```

- [ ] **Step 2: Wire TitleScreen as the `/` route**

Replace `src/routes/index.tsx` contents with:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import TitleScreen from '@/components/TitleScreen'

export const Route = createFileRoute('/')({
  component: TitleScreen,
})
```

- [ ] **Step 3: Verify in dev**

Run: `npm run dev`
Open: `http://localhost:3000/`
Expected: title screen renders with No. 1 (or current day number), streak `—`, played `0`, avg `—`, chin shows time-until-rollover.

- [ ] **Step 4: Commit**

```bash
git add src/components/TitleScreen.tsx src/routes/index.tsx
git commit -m "Add TitleScreen at /"
```

---

## Task 13: `/play` route — daily session + scorecard lock

**Files:**
- Create: `src/routes/play.tsx`

- [ ] **Step 1: Implement the route**

Create `src/routes/play.tsx`:

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import FlipWords from '@/components/FlipWords'
import Scorecard from '@/components/Scorecard'
import { getSessionForDate } from '@/daily/schedule'
import { easternDateString, dayNumber } from '@/daily/date'
import { loadStorage, saveStorage } from '@/daily/storage'
import { recordCompletion } from '@/daily/streak'
import { shareSession } from '@/daily/share'
import type { SessionResult } from '@/daily/types'

export const Route = createFileRoute('/play')({
  component: PlayRoute,
})

function PlayRoute() {
  const navigate = useNavigate()

  // Snapshot the start date so a cross-midnight session still resolves to its
  // original day (per the design spec edge case).
  const [startDate] = useState(() => easternDateString())
  const session = useMemo(() => getSessionForDate(startDate), [startDate])
  const dn = dayNumber(startDate)

  const initial = loadStorage()
  const [existingResult, setExistingResult] = useState(initial.sessions[startDate] ?? null)
  const [practiceMode, setPracticeMode] = useState(false)

  const handleComplete = (result: SessionResult) => {
    // First-completion only — recordCompletion is idempotent.
    const next = recordCompletion(loadStorage(), startDate, result)
    saveStorage(next)
    setExistingResult(next.sessions[startDate] ?? null)
  }

  const handlePractice = () => {
    setPracticeMode(true)
    setExistingResult(null) // hide the scorecard so the game shows
    // FlipWords will re-init via the session prop changing — bump a key
  }

  // Practice run: replay the same session, but onComplete is a no-op.
  if (practiceMode) {
    return (
      <FlipWordsHost
        key={`practice-${Date.now()}`}
        session={session}
        date={startDate}
        dayNumber={dn}
        mode="practice"
        scorecardPrimaryLabel="Back to title"
        scorecardPrimaryIcon="home"
        onScorecardPrimary={() => navigate({ to: '/' })}
        onComplete={undefined}
      />
    )
  }

  // Already-done branch: show the stored scorecard with practice option.
  if (existingResult) {
    return (
      <ScorecardLock
        result={existingResult}
        date={startDate}
        dayNumber={dn}
        onPractice={handlePractice}
        onArchive={() => navigate({ to: '/archive' })}
      />
    )
  }

  // First run of today: play the game; on complete, persist and show scorecard.
  return (
    <FlipWordsHost
      session={session}
      date={startDate}
      dayNumber={dn}
      mode="daily"
      scorecardPrimaryLabel="Share result"
      scorecardPrimaryIcon="ios_share"
      onScorecardPrimary={async () => {
        await shareSession({
          dayNumber: dn,
          stars: existingResult?.stars ?? 1,
          totalDurationMs: existingResult?.totalDurationMs ?? 0,
        })
      }}
      onComplete={handleComplete}
    />
  )
}

function FlipWordsHost(props: React.ComponentProps<typeof FlipWords>) {
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
      <FlipWords {...props} />
    </div>
  )
}

function ScorecardLock({
  result,
  date,
  dayNumber: dn,
  onPractice,
  onArchive,
}: {
  result: { stars: 1 | 2 | 3; perPuzzle: any[]; totalDurationMs: number }
  date: string
  dayNumber: number
  onPractice: () => void
  onArchive: () => void
}) {
  // The Scorecard component needs aggregate stats. Compute from perPuzzle.
  const totalStars = result.perPuzzle.reduce((s, p) => s + p.stars, 0)
  const possible = result.perPuzzle.length * 3
  const overall: 1 | 2 | 3 = totalStars === possible ? 3 : totalStars >= possible * (2 / 3) ? 2 : 1
  const totalGuesses = result.perPuzzle.reduce((s, p) => s + p.attempts, 0)
  const totalHints = result.perPuzzle.reduce((s, p) => s + p.hints, 0)

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
      <Scorecard
        open
        headline="Today's session"
        overallStars={overall}
        totalStars={totalStars}
        possibleStars={possible}
        sessionDurationMs={result.totalDurationMs}
        totalGuesses={totalGuesses}
        totalHints={totalHints}
        perPuzzle={result.perPuzzle}
        primaryLabel="Share result"
        primaryIcon="ios_share"
        onPrimary={() =>
          shareSession({
            dayNumber: dn,
            stars: result.stars,
            totalDurationMs: result.totalDurationMs,
          })
        }
      />
      {/* Practice + Archive secondary actions, rendered above the modal */}
      <div className="fixed bottom-6 inset-x-0 z-[60] flex flex-col items-center gap-2 px-6 pointer-events-none">
        <button
          onClick={onPractice}
          className="pointer-events-auto font-ui flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink py-2 px-3"
        >
          <span className="material-icons text-[18px] text-ink-soft">refresh</span>
          Play again (practice — won't change score)
        </button>
        <button
          onClick={onArchive}
          className="pointer-events-auto font-ui flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink py-1 px-3"
        >
          <span className="material-icons text-[18px] text-ink-soft">history</span>
          Browse archive
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update Scorecard to optionally render a streak chip**

The streak chip lives inside the Scorecard component (per the design). For daily-mode wins, FlipWords needs to pass streak data. For now, we render a minimal chip when given.

Modify `src/components/Scorecard.tsx` to accept optional `streak` prop:

```tsx
export type ScorecardProps = {
  // ...existing...
  streak?: {
    current: number
    best: number
    deltaThisSession: boolean
  } | null
}
```

In the Scorecard body, between the `</h2>` "headline" and the stat grid `<div className="w-full grid grid-cols-3 ...">`, insert:

```tsx
{streak && (
  <div className="w-full mb-4 bg-tile-face border border-tile-edge rounded-[18px] px-3.5 py-3 flex items-center justify-between shadow-tile">
    <div className="flex items-center gap-2.5">
      <span
        className="w-10 h-10 rounded-full inline-flex items-center justify-center"
        style={{ background: 'oklch(94% 0.04 38)', color: 'oklch(64% 0.16 38)' }}
      >
        <span
          className="material-icons text-[22px]"
          style={{ fontVariationSettings: '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 24' }}
        >
          local_fire_department
        </span>
      </span>
      <div className="flex flex-col">
        <span className="font-ui text-[9.5px] text-ink-soft uppercase tracking-[0.18em]">
          Streak
        </span>
        <span className="font-wide text-[26px] text-ink leading-none flex items-baseline gap-1.5">
          {streak.current}
          {streak.deltaThisSession && (
            <span
              className="font-ui text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-[0.08em]"
              style={{ background: 'oklch(94% 0.04 38)', color: 'oklch(64% 0.16 38)' }}
            >
              +1 today
            </span>
          )}
        </span>
      </div>
    </div>
    <div className="text-right">
      <p className="font-ui text-[9.5px] text-ink-soft uppercase tracking-[0.18em]">Best</p>
      <p className="font-expand text-[18px] text-ink leading-none mt-0.5">{streak.best}</p>
    </div>
  </div>
)}
```

- [ ] **Step 3: Wire streak data from FlipWords into the Scorecard**

In `src/components/FlipWords.tsx`, compute the streak snapshot at session-complete time and pass it down. Add to the existing `useEffect` that fires when `showSessionSummary` becomes true (right after the `onComplete` invocation from Task 11, step 4):

```tsx
// Snapshot streak after persistence has run (host's onComplete writes first).
// We read it back from storage on the next tick.
window.setTimeout(() => {
  if (mode !== 'daily') return
  const s = loadStorage()
  setStreakSnapshot({
    current: s.streak.current,
    best: s.streak.best,
    deltaThisSession: s.streak.lastCompletedDate === date,
  })
}, 0)
```

Add the import at the top of the file:

```tsx
import { loadStorage } from '@/daily/storage'
```

And add the local state:

```tsx
const [streakSnapshot, setStreakSnapshot] = useState<{
  current: number
  best: number
  deltaThisSession: boolean
} | null>(null)
```

Pass it into `<Scorecard streak={streakSnapshot} ... />`.

- [ ] **Step 4: Verify**

Run: `npm run dev`
Visit `http://localhost:3000/`
Click "Play today's session" → completes a session.
Expected: scorecard appears, streak chip reads "1" with "+1 today" pill, "Best 1". Share button copies / opens share sheet. Back to `/` then `/play` again shows the locked scorecard with practice + archive options.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/play.tsx src/components/FlipWords.tsx src/components/Scorecard.tsx
git commit -m "Add /play route with daily session, scorecard lock, and streak chip"
```

---

## Task 14: `/archive` route — month calendar

**Files:**
- Create: `src/components/Archive.tsx`
- Create: `src/routes/archive.tsx`

- [ ] **Step 1: Implement Archive component**

Create `src/components/Archive.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { easternDateString, dayNumber, LAUNCH_DATE, shiftDate } from '@/daily/date'
import { loadStorage } from '@/daily/storage'
import type { DailyStorage, StoredSession } from '@/daily/types'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function ymdFromYM(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseYM(date: string): { y: number; m: number } {
  const [y, m] = date.split('-').map(Number)
  return { y, m: m - 1 }
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

function dayOfWeek(year: number, month0: number, day: number): number {
  return new Date(Date.UTC(year, month0, day)).getUTCDay()
}

export default function Archive() {
  const navigate = useNavigate()
  const today = easternDateString()
  const launch = parseYM(LAUNCH_DATE)
  const todayYM = parseYM(today)

  // Default: show today's month
  const [{ y, m }, setMonth] = useState(todayYM)

  const [storage, setStorage] = useState<DailyStorage | null>(null)
  useEffect(() => {
    setStorage(loadStorage())
  }, [])

  const playedCount = storage ? Object.keys(storage.sessions).length : 0
  const totalDaysSinceLaunch = Math.max(0, dayNumber(today))
  const perfects = storage?.totals.perfectSessions ?? 0
  const avgStars = (() => {
    if (!storage || playedCount === 0) return '—'
    const total = Object.values(storage.sessions).reduce((s, r) => s + r.stars, 0)
    return (total / playedCount).toFixed(1)
  })()

  const cells = useMemo(() => {
    const total = daysInMonth(y, m)
    const padFront = dayOfWeek(y, m, 1)
    const out: Array<{ kind: 'empty' } | { kind: 'day'; day: number; date: string }> = []
    for (let i = 0; i < padFront; i++) out.push({ kind: 'empty' })
    for (let d = 1; d <= total; d++) out.push({ kind: 'day', day: d, date: ymdFromYM(y, m, d) })
    return out
  }, [y, m])

  const canGoBack = !(y === launch.y && m === launch.m)
  const canGoForward = !(y === todayYM.y && m === todayYM.m)

  const goPrev = () => {
    if (!canGoBack) return
    setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))
  }
  const goNext = () => {
    if (!canGoForward) return
    setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-chin overflow-hidden">
      <div className="flex-1 min-h-0 mt-1.5 md:mt-2 flex flex-col bg-paper rounded-[28px] md:rounded-[36px] shadow-play-lift relative z-10 overflow-y-auto px-4 py-4 md:px-6 md:py-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <Link
            to="/"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-tile-edge text-ink-muted hover:text-ink shadow-tile"
            aria-label="Back"
          >
            <span className="material-icons text-[20px]">chevron_left</span>
          </Link>
          <h1 className="font-wide text-xl text-ink tracking-[-0.01em]">Archive</h1>
          <div className="w-10 h-10" />
        </div>

        {/* Summary card */}
        <div className="grid grid-cols-3 border border-tile-edge rounded-[14px] bg-tile-face shadow-tile overflow-hidden mb-4">
          <SummaryCell value={playedCount.toString()} label="Played" />
          <SummaryCell value={perfects.toString()} label="Perfect" />
          <SummaryCell value={avgStars} label="Avg ★" />
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between pb-2.5">
          <button
            onClick={goPrev}
            disabled={!canGoBack}
            className={`p-1 ${canGoBack ? 'text-ink-muted hover:text-ink' : 'text-ink-soft/30'}`}
          >
            <span className="material-icons">chevron_left</span>
          </button>
          <p className="font-expand text-[17px] text-ink">
            {MONTH_NAMES[m]} {y}
          </p>
          <button
            onClick={goNext}
            disabled={!canGoForward}
            className={`p-1 ${canGoForward ? 'text-ink-muted hover:text-ink' : 'text-ink-soft/30'}`}
          >
            <span className="material-icons">chevron_right</span>
          </button>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEKDAY_LABELS.map((w, i) => (
            <span
              key={i}
              className="text-center font-ui text-[10px] text-ink-soft uppercase tracking-[0.18em]"
            >
              {w}
            </span>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((cell, i) => {
            if (cell.kind === 'empty') {
              return <div key={i} className="aspect-square" />
            }
            return (
              <DayCell
                key={i}
                day={cell.day}
                date={cell.date}
                today={today}
                launch={LAUNCH_DATE}
                stored={storage?.sessions[cell.date]}
                onClick={() => navigate({ to: '/archive/$date', params: { date: cell.date } })}
              />
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3.5 pt-3.5 pb-2 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-[3px] border"
              style={{
                background:
                  'linear-gradient(180deg, oklch(96% 0.06 180), oklch(92% 0.05 180))',
                borderColor: 'var(--color-accent)',
              }}
            />
            3-star
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-[3px] bg-tile-face border border-tile-edge" />
            Played
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-[3px]"
              style={{
                background: 'oklch(94% 0.012 85 / 0.45)',
                border: '1px dashed var(--color-paper-line)',
              }}
            />
            Missed
          </span>
        </div>
      </div>

      {/* Chin */}
      <div
        className="flex-shrink-0 bg-chin text-surface relative"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="relative z-20 w-full max-w-3xl mx-auto px-5 md:px-7 pt-3 md:pt-4 pb-1 flex items-center justify-between gap-4">
          <span className="font-ui text-[12px] uppercase tracking-[0.18em] text-surface/85">
            {playedCount} of {totalDaysSinceLaunch} sessions
          </span>
          <span className="font-ui text-[12px] uppercase tracking-[0.18em] text-surface/85">
            Tap a day
          </span>
        </div>
      </div>
    </div>
  )
}

function SummaryCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center py-3 border-l border-tile-edge first:border-l-0">
      <p className="font-expand text-[22px] text-ink leading-none">{value}</p>
      <p className="font-ui text-[10px] text-ink-soft uppercase tracking-[0.18em] mt-1.5">
        {label}
      </p>
    </div>
  )
}

function DayCell({
  day,
  date,
  today,
  launch,
  stored,
  onClick,
}: {
  day: number
  date: string
  today: string
  launch: string
  stored?: StoredSession
  onClick: () => void
}) {
  const isFuture = date > today
  const isPreLaunch = date < launch
  const isToday = date === today
  const isThreeStar = stored?.stars === 3
  const isPlayed = !!stored && !isThreeStar
  const isMissed = !stored && !isFuture && !isPreLaunch

  let cls = 'aspect-square rounded-[5px] flex flex-col items-center justify-center text-[12px] font-ui '
  if (isFuture) {
    cls += 'text-ink-soft/40 cursor-default'
  } else if (isPreLaunch) {
    cls += 'opacity-30 cursor-default'
  } else if (isThreeStar) {
    cls +=
      'text-ink border border-accent cursor-pointer ' +
      '[background:linear-gradient(180deg,oklch(96%_0.06_180),oklch(92%_0.05_180))]'
  } else if (isPlayed) {
    cls += 'text-ink bg-tile-face border border-tile-edge cursor-pointer shadow-tile/40'
  } else if (isMissed) {
    cls +=
      'text-ink-soft cursor-default border border-dashed border-paper-line ' +
      '[background:oklch(94%_0.012_85_/_0.45)]'
  }
  if (isToday) cls += ' ring-2 ring-accent'

  const tappable = !isFuture && !isPreLaunch && !isMissed
  return (
    <button
      type="button"
      onClick={tappable ? onClick : undefined}
      className={cls}
      disabled={!tappable}
    >
      <span className="leading-none">{day}</span>
      {stored && (
        <span className="inline-flex gap-px mt-1">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className="material-icons"
              style={{
                fontSize: 9,
                color:
                  n <= stored.stars ? 'var(--color-accent)' : 'var(--color-tile-edge)',
                fontVariationSettings:
                  n <= stored.stars
                    ? '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 20'
                    : '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 20',
              }}
            >
              star
            </span>
          ))}
        </span>
      )}
    </button>
  )
}

// Re-export for test simplicity
export { dayNumber, shiftDate }
```

- [ ] **Step 2: Wire the route**

Create `src/routes/archive.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import Archive from '@/components/Archive'

export const Route = createFileRoute('/archive')({
  component: Archive,
})
```

- [ ] **Step 3: Verify**

Run: `npm run dev`. Visit `/archive`.
Expected: calendar renders for current month. Today's cell has the accent ring. Past dates are missed (dashed) until you play one. Forward arrow disabled.

Play one daily session, then revisit `/archive`. Expected: today's cell is now `played` or `three-star` (depending on result).

- [ ] **Step 4: Commit**

```bash
git add src/components/Archive.tsx src/routes/archive.tsx
git commit -m "Add /archive month calendar"
```

---

## Task 15: `/archive/$date` route — replay a past session

**Files:**
- Create: `src/routes/archive.$date.tsx`

- [ ] **Step 1: Implement route**

Create `src/routes/archive.$date.tsx`:

```tsx
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import FlipWords from '@/components/FlipWords'
import { getSessionForDate } from '@/daily/schedule'
import { dayNumber, LAUNCH_DATE, easternDateString } from '@/daily/date'

export const Route = createFileRoute('/archive/$date')({
  component: ArchiveReplay,
})

function ArchiveReplay() {
  const navigate = useNavigate()
  const { date } = useParams({ from: '/archive/$date' })

  // Guardrails: refuse pre-launch and future dates.
  const today = easternDateString()
  if (date < LAUNCH_DATE || date > today) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-paper p-6">
        <div className="text-center">
          <p className="font-wide text-2xl text-ink mb-3">No puzzle for that date.</p>
          <button
            onClick={() => navigate({ to: '/archive' })}
            className="font-ui bg-ink text-surface rounded-full px-5 py-2.5"
          >
            Back to archive
          </button>
        </div>
      </div>
    )
  }

  const session = getSessionForDate(date)
  const dn = dayNumber(date)

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
      <FlipWords
        session={session}
        mode="archive"
        date={date}
        dayNumber={dn}
        scorecardPrimaryLabel="Back to archive"
        scorecardPrimaryIcon="history"
        onScorecardPrimary={() => navigate({ to: '/archive' })}
        onComplete={undefined}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify the route**

Run: `npm run dev`. Visit `/archive`, tap a past day cell that's `played`. Expected: full session replays. On completion, scorecard appears with "Back to archive" primary button. Storage is **not** modified — confirm by checking `localStorage.getItem('flipwords_daily_v1')` in devtools: the stars for that date should reflect your original play, not the replay.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/routes/archive.\$date.tsx
git commit -m "Add /archive/\$date route for replay"
```

---

## Task 16: Production smoke pass

Manual QA pass — no code changes, just verification against the spec's acceptance criteria.

- [ ] **Step 1: Run typecheck + tests + build**

```bash
npx tsc --noEmit
npm test
npm run build
```

Expected: all clean, no failures, build produces `dist/`.

- [ ] **Step 2: Manual QA checklist**

Run: `npm run dev`. Walk through each:

- [ ] Visit `/` first time → title screen shows No. 1 (or current day if past launch), streak `—`, played `0`, avg `—`
- [ ] Tap "Play today's session" → daily session runs deterministically (same 5 puzzles in the same order if you reload)
- [ ] Complete session → scorecard shows streak chip with `1` and `+1 today` pill, primary CTA is "Share result"
- [ ] Tap Share on a desktop browser → string copied to clipboard (verify by pasting). Expected format: `FlipWords No. NNN\n★★☆ — m:ss\nflipwords.superfun.games`
- [ ] Back to `/` → primary CTA now reads "View today's scorecard"
- [ ] Tap it → scorecard appears with practice + archive options below
- [ ] Tap practice → session re-runs; on completion, scorecard appears again but localStorage is unchanged (verify via devtools)
- [ ] Visit `/archive` → calendar renders, today's cell has accent ring + stars from your first run
- [ ] Tap a missed cell (any past date with no record) → not interactive (cursor doesn't change to pointer)
- [ ] Tap your played-today cell → replays the session; scorecard CTA is "Back to archive"
- [ ] Verify in devtools that `flipwords_daily_v1.sessions['<today>']` is unchanged after the archive replay
- [ ] Open devtools console: `localStorage.setItem('flipwords_daily_v1', JSON.stringify({schemaVersion:1, streak:{current:5,best:7,lastCompletedDate:'2026-05-12'}, sessions:{}, totals:{sessionsPlayed:5,perfectSessions:1}}))` — reload `/`. Streak should display `0` (5 days have elapsed since `2026-05-12`, `settleStreak` runs on mount), best preserved as `7`
- [ ] Confirm `prefers-reduced-motion` is honored (existing behavior — confetti and scorecard animations should be quiet)

- [ ] **Step 3: Commit the QA log**

Create `docs/superpowers/qa/2026-05-18-daily.md` with the checked-off list above (use the actual results — note anything that failed and was fixed). Then:

```bash
git add docs/superpowers/qa/2026-05-18-daily.md
git commit -m "Manual QA log for daily play"
```

---

## Self-review

Scanned the plan against the spec section-by-section:

| Spec section | Plan task(s) |
|---|---|
| Locked decisions (table) | Tasks 3–7 (utilities), 11 (FlipWords prop refactor), 13 (`/play`), 14 (`/archive`) |
| Module layout | Tasks 2–7 (`src/daily/*`), 10 (`<Scorecard>`), 12 (`<TitleScreen>`), 14 (`<Archive>`), 15 (`archive.$date`) |
| Date math | Tasks 3–5 (`easternDateString`, `dayNumber`, `shiftDate`, `msUntilNextRollover`) |
| Daily picker | Task 6 (`pickSessionLevelsSeeded` + `getSessionForDate`) |
| Persistence (`flipwords_daily_v1`) | Task 7 (`storage.ts` with version guard) |
| Streak rules (tick / settle / record / idempotent replay) | Task 8 + tests |
| Routing (`/`, `/play`, `/archive`, `/archive/$date`) | Tasks 12, 13, 14, 15 |
| Share string format | Task 9 + Task 13 wiring |
| Practice replay (today) | Task 13 (`practiceMode` branch, no `onComplete`) |
| Visual: title screen | Task 12 |
| Visual: scorecard with streak chip + share CTA | Tasks 10 + 13 |
| Visual: archive calendar + cell states | Task 14 |
| Edge case: cross-midnight (use start date) | Task 13 (`useState(() => easternDateString())` snapshots once) |
| Edge case: missed-day reset on app load | Task 12 (`settleStreak` on TitleScreen mount) |
| Verification (unit + manual QA) | Tasks 3–9 (unit), 16 (manual QA list mirrors spec) |
| V2 / out-of-scope (Stats link) | Task 12 ships title screen without a Stats link (per spec) |

Placeholder scan: clean. Every step has either a complete code block, a specific command with expected output, or both.

Type consistency: `SessionResult` shape matches across tasks 2, 8, 11, 13. `DailyStorage.sessions` keyed by `EasternDate` (string) throughout. `mode: 'daily' | 'archive' | 'practice'` matches between FlipWords prop and route call sites. Function names stable (`tickStreak`, `settleStreak`, `recordCompletion`, `loadStorage`, `saveStorage`, `freshStorage`, `getSessionForDate`, `easternDateString`, `dayNumber`, `shiftDate`, `msUntilNextRollover`, `formatShareString`, `shareSession`).

One known coarse seam: Task 11 step 4 has the `onComplete` invocation use `computeStars` (the existing local helper in FlipWords.tsx). It's already defined in the current file (line 109) — no need to redeclare. The reviewer should leave it where it is.

---

## Execution Handoff

Plan complete and saved to [docs/superpowers/plans/2026-05-18-daily-play-streaks.md](docs/superpowers/plans/2026-05-18-daily-play-streaks.md). Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a feature this size: 16 tasks is too many to hold in one context, and the per-task review catches drift before it compounds.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`. Batches multiple tasks with checkpoints. Faster for trivial steps, but with 16 substantial tasks this session will grow large.

Which approach?
