# Robust Daily Play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the daily loop — storage v2 with migrations, mid-session resume at puzzle boundaries, playable "makeup" days from the archive, live midnight rollover, and a Wordle-style share format.

**Architecture:** Versioned localStorage schema (v2) with pure migration functions; the `FlipWords` component stays persistence-agnostic and reports progress to its host route via `onProgress`/`initialProgress`; routes own all reads/writes through small pure helpers (`progress.ts`, `streak.ts`) plus two hooks (`useEasternDate`, `useDailyStorage`).

**Tech Stack:** React 19, TanStack Router/Start, Vitest + jsdom + @testing-library/react, localStorage.

**Spec:** `docs/superpowers/specs/2026-07-02-robust-daily-play-design.md`

**File map:**

| File | Role |
|---|---|
| `src/daily/types.ts` | v2 types: `StoredSession.mode`, `InProgressSession`, `RecordMode` |
| `src/daily/storage.ts` | v1→v2 migration, unknown-version backup |
| `src/daily/streak.ts` | `recordCompletion` gains `mode`, clears matching `inProgress` |
| `src/daily/progress.ts` (new) | pure inProgress write/read/validate/clear |
| `src/daily/share.ts` | new share format |
| `src/daily/useEasternDate.ts` (new) | rollover-aware date hook |
| `src/daily/useDailyStorage.ts` (new) | storage state + cross-tab sync hook |
| `src/components/FlipWords.tsx` | `initialProgress` / `onProgress` props |
| `src/routes/play.tsx` | resume wiring, share plumbing, rollover CTA |
| `src/routes/archive_.$date.tsx` | makeup mode, today-redirect |
| `src/components/Archive.tsx` | tappable missed cells, late glyph, legend |
| `src/components/TitleScreen.tsx` | live date, storage sync, new-puzzle pulse |

Run all tests with `npm test`; a single file with `npx vitest run tests/daily/storage.test.ts`. Type-check with `npx tsc --noEmit`.

---

### Task 1: Storage v2 — types, migration, backup

**Files:**
- Modify: `src/daily/types.ts`
- Modify: `src/daily/storage.ts`
- Modify: `src/daily/streak.ts` (minimal: write `mode: 'daily'` so it compiles)
- Test: `tests/daily/storage.test.ts`

- [ ] **Step 1: Update types**

In `src/daily/types.ts`, replace the `StoredSession` and `DailyStorage` definitions (keep everything else):

```ts
/** How a completed session was earned. Daily = played on its calendar day. */
export type RecordMode = 'daily' | 'makeup'

export type StoredSession = Omit<SessionResult, 'date' | 'dayNumber'> & {
  mode: RecordMode
}

/** A daily/makeup session that has been started but not finished. */
export type InProgressSession = {
  date: EasternDate
  mode: RecordMode
  /** Results for puzzles ALREADY completed — never includes the one underway. */
  puzzlesDone: PuzzleResult[]
  /** Index of the puzzle being played. Invariant: === puzzlesDone.length. */
  currentIdx: number
  /** Session-timer snapshot (visible-time ms). */
  elapsedMs: number
  startedAt: number
  updatedAt: number
}

export type DailyStorage = {
  schemaVersion: 2
  streak: StreakState
  sessions: { [date: EasternDate]: StoredSession }
  totals: {
    sessionsPlayed: number
    perfectSessions: number
  }
  inProgress: InProgressSession | null
}
```

- [ ] **Step 2: Write the failing tests**

Replace `tests/daily/storage.test.ts` with:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadStorage,
  saveStorage,
  freshStorage,
  STORAGE_KEY,
  BACKUP_KEY,
} from '@/daily/storage'

describe('storage v2', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('freshStorage returns a valid empty v2 shape', () => {
    const s = freshStorage()
    expect(s.schemaVersion).toBe(2)
    expect(s.streak).toEqual({ current: 0, best: 0, lastCompletedDate: null })
    expect(s.sessions).toEqual({})
    expect(s.totals).toEqual({ sessionsPlayed: 0, perfectSessions: 0 })
    expect(s.inProgress).toBeNull()
  })

  it('loadStorage returns fresh state when no key set', () => {
    expect(loadStorage()).toEqual(freshStorage())
  })

  it('saveStorage + loadStorage round-trip', () => {
    const s = freshStorage()
    s.streak.current = 3
    s.streak.best = 5
    s.streak.lastCompletedDate = '2026-05-19'
    s.inProgress = {
      date: '2026-05-20',
      mode: 'daily',
      puzzlesDone: [],
      currentIdx: 0,
      elapsedMs: 1234,
      startedAt: 1,
      updatedAt: 2,
    }
    saveStorage(s)
    expect(loadStorage()).toEqual(s)
  })

  it('migrates v1 data: isDailyResult becomes mode "daily", inProgress added', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        streak: { current: 4, best: 9, lastCompletedDate: '2026-06-30' },
        sessions: {
          '2026-06-30': {
            completedAt: 1000,
            stars: 3,
            perPuzzle: [],
            totalDurationMs: 5000,
            isDailyResult: true,
          },
        },
        totals: { sessionsPlayed: 12, perfectSessions: 4 },
      })
    )
    const s = loadStorage()
    expect(s.schemaVersion).toBe(2)
    expect(s.streak).toEqual({ current: 4, best: 9, lastCompletedDate: '2026-06-30' })
    expect(s.sessions['2026-06-30'].mode).toBe('daily')
    expect(
      (s.sessions['2026-06-30'] as unknown as { isDailyResult?: boolean }).isDailyResult
    ).toBeUndefined()
    expect(s.totals).toEqual({ sessionsPlayed: 12, perfectSessions: 4 })
    expect(s.inProgress).toBeNull()
  })

  it('backs up and starts fresh on unknown future schemaVersion', () => {
    const blob = JSON.stringify({ schemaVersion: 99, something: 'precious' })
    window.localStorage.setItem(STORAGE_KEY, blob)
    expect(loadStorage()).toEqual(freshStorage())
    expect(window.localStorage.getItem(BACKUP_KEY)).toBe(blob)
  })

  it('backs up and starts fresh on corrupt JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json{')
    expect(loadStorage()).toEqual(freshStorage())
    expect(window.localStorage.getItem(BACKUP_KEY)).toBe('not-json{')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/daily/storage.test.ts`
Expected: FAIL — `BACKUP_KEY` not exported, schemaVersion 1 vs 2, migration missing.

- [ ] **Step 4: Implement storage.ts**

Replace `src/daily/storage.ts` with:

```ts
import type { DailyStorage, StoredSession } from './types'

export const STORAGE_KEY = 'flipwords_daily_v1' // key is stable; schemaVersion governs shape
export const BACKUP_KEY = 'flipwords_daily_backup'

export function freshStorage(): DailyStorage {
  return {
    schemaVersion: 2,
    streak: { current: 0, best: 0, lastCompletedDate: null },
    sessions: {},
    totals: { sessionsPlayed: 0, perfectSessions: 0 },
    inProgress: null,
  }
}

type V1Session = Omit<StoredSession, 'mode'> & { isDailyResult?: true }
type V1Storage = {
  schemaVersion: 1
  streak?: DailyStorage['streak']
  sessions?: { [date: string]: V1Session }
  totals?: DailyStorage['totals']
}

function migrateV1(parsed: V1Storage): DailyStorage {
  const sessions: DailyStorage['sessions'] = {}
  for (const [date, s] of Object.entries(parsed.sessions ?? {})) {
    const { isDailyResult: _legacy, ...rest } = s
    sessions[date] = { ...rest, mode: 'daily' }
  }
  return {
    schemaVersion: 2,
    streak: parsed.streak ?? freshStorage().streak,
    sessions,
    totals: parsed.totals ?? freshStorage().totals,
    inProgress: null,
  }
}

/** Copy the raw blob aside before abandoning it — never silently destroy data. */
function backupAndStartFresh(raw: string): DailyStorage {
  try {
    window.localStorage.setItem(BACKUP_KEY, raw)
  } catch {
    // Quota/private-mode failures shouldn't block the game from loading.
  }
  return freshStorage()
}

export function loadStorage(): DailyStorage {
  if (typeof window === 'undefined') return freshStorage()
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return freshStorage()
  try {
    const parsed = JSON.parse(raw) as { schemaVersion?: unknown }
    if (parsed?.schemaVersion === 1) return migrateV1(parsed as V1Storage)
    if (parsed?.schemaVersion === 2) {
      const p = parsed as Partial<DailyStorage>
      return {
        schemaVersion: 2,
        streak: p.streak ?? freshStorage().streak,
        sessions: p.sessions ?? {},
        totals: p.totals ?? freshStorage().totals,
        inProgress: p.inProgress ?? null,
      }
    }
    return backupAndStartFresh(raw)
  } catch {
    return backupAndStartFresh(raw)
  }
}

export function saveStorage(s: DailyStorage): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}
```

- [ ] **Step 5: Fix the compile break in streak.ts**

In `src/daily/streak.ts`, inside `recordCompletion`, replace the session literal's `isDailyResult: true` line with `mode: 'daily'`, and carry `inProgress` through (full makeup semantics land in Task 2):

```ts
    sessions: {
      ...ticked.sessions,
      [today]: {
        completedAt: result.completedAt,
        stars: result.stars,
        perPuzzle: result.perPuzzle,
        totalDurationMs: result.totalDurationMs,
        mode: 'daily',
      },
    },
```

- [ ] **Step 6: Verify tests pass and nothing else broke**

Run: `npx vitest run tests/daily/storage.test.ts` → PASS
Run: `npm test` → all pass (streak tests don't assert `isDailyResult`)
Run: `npx tsc --noEmit` → clean. If `src/routes/play.tsx` or others reference `isDailyResult`, remove the reference (audit found none).

- [ ] **Step 7: Commit**

```bash
git add src/daily/types.ts src/daily/storage.ts src/daily/streak.ts tests/daily/storage.test.ts
git commit -m "Storage v2: mode on sessions, inProgress slot, v1 migration, backup on unknown"
```

---

### Task 2: Makeup mode in recordCompletion

**Files:**
- Modify: `src/daily/streak.ts`
- Test: `tests/daily/streak.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/daily/streak.test.ts` (inside the file, after the existing `recordCompletion` describe):

```ts
describe('recordCompletion — makeup mode', () => {
  it('records the session with mode makeup and bumps totals', () => {
    const s = recordCompletion(freshStorage(), '2026-05-19', makeResult('2026-05-19', 3), 'makeup')
    expect(s.sessions['2026-05-19'].mode).toBe('makeup')
    expect(s.totals.sessionsPlayed).toBe(1)
    expect(s.totals.perfectSessions).toBe(1)
  })

  it('NEVER ticks the streak', () => {
    let s = tickStreak(freshStorage(), '2026-06-01') // current streak 1
    s = recordCompletion(s, '2026-06-02', makeResult('2026-06-02', 2), 'makeup')
    expect(s.streak).toEqual({ current: 1, best: 1, lastCompletedDate: '2026-06-01' })
  })

  it('daily mode is the default and still ticks streak', () => {
    const s = recordCompletion(freshStorage(), '2026-05-19', makeResult('2026-05-19', 2))
    expect(s.sessions['2026-05-19'].mode).toBe('daily')
    expect(s.streak.current).toBe(1)
  })

  it('clears a matching inProgress record on completion', () => {
    const base = freshStorage()
    base.inProgress = {
      date: '2026-05-19', mode: 'daily', puzzlesDone: [], currentIdx: 0,
      elapsedMs: 100, startedAt: 1, updatedAt: 2,
    }
    const s = recordCompletion(base, '2026-05-19', makeResult('2026-05-19', 2))
    expect(s.inProgress).toBeNull()
  })

  it('leaves an unrelated inProgress record alone', () => {
    const base = freshStorage()
    base.inProgress = {
      date: '2026-05-10', mode: 'makeup', puzzlesDone: [], currentIdx: 0,
      elapsedMs: 100, startedAt: 1, updatedAt: 2,
    }
    const s = recordCompletion(base, '2026-05-19', makeResult('2026-05-19', 2))
    expect(s.inProgress?.date).toBe('2026-05-10')
  })

  it('is idempotent for makeup too', () => {
    let s = recordCompletion(freshStorage(), '2026-05-19', makeResult('2026-05-19', 2), 'makeup')
    s = recordCompletion(s, '2026-05-19', makeResult('2026-05-19', 3), 'makeup')
    expect(s.totals.sessionsPlayed).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/daily/streak.test.ts`
Expected: FAIL — `recordCompletion` takes 3 args; makeup ticks streak; inProgress untouched.

- [ ] **Step 3: Implement**

Replace `recordCompletion` in `src/daily/streak.ts` with:

```ts
import type { DailyStorage, RecordMode, SessionResult } from './types'
```

(update the import at the top of the file to include `RecordMode`), then:

```ts
export function recordCompletion(
  s: DailyStorage,
  today: string,
  result: SessionResult,
  mode: RecordMode = 'daily'
): DailyStorage {
  if (s.sessions[today]) return s // idempotent
  // Makeup completions never touch the streak — it only rewards playing on
  // the actual day. Both modes count toward totals.
  const ticked = mode === 'daily' ? tickStreak(s, today) : s
  return {
    ...ticked,
    sessions: {
      ...ticked.sessions,
      [today]: {
        completedAt: result.completedAt,
        stars: result.stars,
        perPuzzle: result.perPuzzle,
        totalDurationMs: result.totalDurationMs,
        mode,
      },
    },
    totals: {
      sessionsPlayed: ticked.totals.sessionsPlayed + 1,
      perfectSessions:
        ticked.totals.perfectSessions + (result.stars === 3 ? 1 : 0),
    },
    inProgress:
      ticked.inProgress?.date === today ? null : ticked.inProgress,
  }
}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/daily/streak.test.ts` → PASS. Run `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/daily/streak.ts tests/daily/streak.test.ts
git commit -m "recordCompletion: makeup mode counts totals, never streak; clears inProgress"
```

---

### Task 3: Progress helpers (write / read+validate / clear)

**Files:**
- Create: `src/daily/progress.ts`
- Test: `tests/daily/progress.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/daily/progress.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { writeProgress, readProgress, clearProgress } from '@/daily/progress'
import { freshStorage } from '@/daily/storage'
import type { PuzzleResult } from '@/daily/types'

const puzzle = (stars: 1 | 2 | 3 = 3): PuzzleResult => ({
  attempts: 1,
  hints: 0,
  durationMs: 45_000,
  stars,
})

describe('writeProgress', () => {
  it('stores a new inProgress record with startedAt = now', () => {
    const s = writeProgress(
      freshStorage(),
      '2026-07-02',
      'daily',
      { puzzlesDone: [puzzle()], currentIdx: 1, elapsedMs: 60_000 },
      1000
    )
    expect(s.inProgress).toEqual({
      date: '2026-07-02',
      mode: 'daily',
      puzzlesDone: [puzzle()],
      currentIdx: 1,
      elapsedMs: 60_000,
      startedAt: 1000,
      updatedAt: 1000,
    })
  })

  it('preserves startedAt across updates to the same date+mode', () => {
    let s = writeProgress(freshStorage(), '2026-07-02', 'daily',
      { puzzlesDone: [], currentIdx: 0, elapsedMs: 5_000 }, 1000)
    s = writeProgress(s, '2026-07-02', 'daily',
      { puzzlesDone: [puzzle()], currentIdx: 1, elapsedMs: 70_000 }, 2000)
    expect(s.inProgress?.startedAt).toBe(1000)
    expect(s.inProgress?.updatedAt).toBe(2000)
  })

  it('a different date replaces the record (latest wins)', () => {
    let s = writeProgress(freshStorage(), '2026-07-01', 'makeup',
      { puzzlesDone: [], currentIdx: 0, elapsedMs: 5_000 }, 1000)
    s = writeProgress(s, '2026-07-02', 'daily',
      { puzzlesDone: [], currentIdx: 0, elapsedMs: 0 }, 2000)
    expect(s.inProgress?.date).toBe('2026-07-02')
    expect(s.inProgress?.startedAt).toBe(2000)
  })
})

describe('readProgress', () => {
  const base = () =>
    writeProgress(freshStorage(), '2026-07-02', 'daily',
      { puzzlesDone: [puzzle(), puzzle(2)], currentIdx: 2, elapsedMs: 120_000 }, 1000)

  it('returns the record for a matching date+mode', () => {
    const p = readProgress(base(), '2026-07-02', 'daily')
    expect(p?.currentIdx).toBe(2)
    expect(p?.puzzlesDone).toHaveLength(2)
  })

  it('returns null for a different date or mode', () => {
    expect(readProgress(base(), '2026-07-01', 'daily')).toBeNull()
    expect(readProgress(base(), '2026-07-02', 'makeup')).toBeNull()
  })

  it('returns null when the session was already completed', () => {
    const s = base()
    s.sessions['2026-07-02'] = {
      completedAt: 1, stars: 3, perPuzzle: [], totalDurationMs: 1, mode: 'daily',
    }
    expect(readProgress(s, '2026-07-02', 'daily')).toBeNull()
  })

  it('rejects malformed records: length mismatch, bad index, bad results', () => {
    const s1 = base()
    s1.inProgress!.currentIdx = 3 // != puzzlesDone.length
    expect(readProgress(s1, '2026-07-02', 'daily')).toBeNull()

    const s2 = base()
    s2.inProgress!.currentIdx = 7
    s2.inProgress!.puzzlesDone = new Array(7).fill(puzzle())
    expect(readProgress(s2, '2026-07-02', 'daily')).toBeNull()

    const s3 = base()
    ;(s3.inProgress!.puzzlesDone[0] as { stars: unknown }).stars = 9
    expect(readProgress(s3, '2026-07-02', 'daily')).toBeNull()

    const s4 = base()
    ;(s4.inProgress as { elapsedMs: unknown }).elapsedMs = 'soon'
    expect(readProgress(s4, '2026-07-02', 'daily')).toBeNull()
  })
})

describe('clearProgress', () => {
  it('clears an existing record and is a no-op otherwise', () => {
    const s = writeProgress(freshStorage(), '2026-07-02', 'daily',
      { puzzlesDone: [], currentIdx: 0, elapsedMs: 0 }, 1)
    expect(clearProgress(s).inProgress).toBeNull()
    const empty = freshStorage()
    expect(clearProgress(empty)).toBe(empty)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/daily/progress.test.ts`
Expected: FAIL — module `@/daily/progress` does not exist.

- [ ] **Step 3: Implement**

Create `src/daily/progress.ts`:

```ts
import type {
  DailyStorage,
  EasternDate,
  InProgressSession,
  PuzzleResult,
  RecordMode,
} from './types'

export type ProgressUpdate = {
  puzzlesDone: PuzzleResult[]
  currentIdx: number
  elapsedMs: number
}

/**
 * Record (or update) the single in-progress session. Latest write wins;
 * startedAt survives updates to the same date+mode so "when did they start"
 * stays truthful across reloads.
 */
export function writeProgress(
  s: DailyStorage,
  date: EasternDate,
  mode: RecordMode,
  update: ProgressUpdate,
  now: number = Date.now()
): DailyStorage {
  const prior = s.inProgress
  const startedAt =
    prior && prior.date === date && prior.mode === mode ? prior.startedAt : now
  return {
    ...s,
    inProgress: { date, mode, ...update, startedAt, updatedAt: now },
  }
}

export function clearProgress(s: DailyStorage): DailyStorage {
  return s.inProgress === null ? s : { ...s, inProgress: null }
}

const isValidResult = (r: PuzzleResult): boolean =>
  typeof r === 'object' &&
  r !== null &&
  typeof r.attempts === 'number' &&
  typeof r.hints === 'number' &&
  typeof r.durationMs === 'number' &&
  (r.stars === 1 || r.stars === 2 || r.stars === 3)

/**
 * The inProgress record for this date+mode, or null if absent, stale, or
 * malformed. Malformed records are treated as absent — the next write
 * overwrites them, so no repair pass is needed.
 */
export function readProgress(
  s: DailyStorage,
  date: EasternDate,
  mode: RecordMode
): InProgressSession | null {
  const p = s.inProgress
  if (!p || p.date !== date || p.mode !== mode) return null
  if (s.sessions[date]) return null // already completed — progress is stale
  if (!Number.isInteger(p.currentIdx) || p.currentIdx < 0 || p.currentIdx > 4)
    return null
  if (!Array.isArray(p.puzzlesDone) || p.puzzlesDone.length !== p.currentIdx)
    return null
  if (typeof p.elapsedMs !== 'number' || !(p.elapsedMs >= 0)) return null
  if (!p.puzzlesDone.every(isValidResult)) return null
  return p
}
```

- [ ] **Step 4: Verify** — `npx vitest run tests/daily/progress.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/daily/progress.ts tests/daily/progress.test.ts
git commit -m "Add progress helpers: single inProgress slot with validation"
```

---

### Task 4: Share format v2

**Files:**
- Modify: `src/daily/share.ts`
- Modify: `src/routes/play.tsx` (both call sites)
- Test: `tests/daily/share.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace `tests/daily/share.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { formatShareString } from '@/daily/share'

const FIVE_STARS: Array<1 | 2 | 3> = [3, 2, 3, 3, 3]

describe('formatShareString', () => {
  it('daily result with streak >= 2 includes the streak line', () => {
    expect(
      formatShareString({
        dayNumber: 46,
        perPuzzleStars: FIVE_STARS,
        totalDurationMs: 211_000,
        streak: 12,
      })
    ).toBe(
      'FLIPWORDS No. 046\n★★★ ★★☆ ★★★ ★★★ ★★★ — 3:31\n🔥 12-day streak\nflipwords.superfun.games'
    )
  })

  it('streak of 1 (or 0) omits the streak line', () => {
    expect(
      formatShareString({
        dayNumber: 46,
        perPuzzleStars: FIVE_STARS,
        totalDurationMs: 211_000,
        streak: 1,
      })
    ).toBe(
      'FLIPWORDS No. 046\n★★★ ★★☆ ★★★ ★★★ ★★★ — 3:31\nflipwords.superfun.games'
    )
  })

  it('makeup result is marked (late) and never shows a streak line', () => {
    expect(
      formatShareString({
        dayNumber: 38,
        perPuzzleStars: [1, 2, 2, 3, 3],
        totalDurationMs: 611_000,
        streak: 12,
        late: true,
      })
    ).toBe(
      'FLIPWORDS No. 038 (late)\n★☆☆ ★★☆ ★★☆ ★★★ ★★★ — 10:11\nflipwords.superfun.games'
    )
  })

  it('pads small day numbers to 3 digits, leaves large ones alone', () => {
    const base = { perPuzzleStars: FIVE_STARS, totalDurationMs: 60_000, streak: 0 }
    expect(formatShareString({ ...base, dayNumber: 7 })).toContain('No. 007')
    expect(formatShareString({ ...base, dayNumber: 1234 })).toContain('No. 1234')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/daily/share.test.ts`
Expected: FAIL — old input shape / old format.

- [ ] **Step 3: Implement**

In `src/daily/share.ts`, replace `ShareInput`, `formatShareString` (keep `formatTime`, `padNumber`, `starString`, `shareSession`, `SITE_URL` as they are — `shareSession`'s body doesn't change, only its input type flows through):

```ts
export type ShareInput = {
  dayNumber: number
  /** One entry per puzzle, in play order. */
  perPuzzleStars: Array<1 | 2 | 3>
  totalDurationMs: number
  /** Current streak; rendered only when >= 2 and not a late share. */
  streak: number
  /** True when sharing a makeup (played-late) result. */
  late?: boolean
}
```

```ts
export function formatShareString(input: ShareInput): string {
  const headline = `FLIPWORDS No. ${padNumber(input.dayNumber)}${input.late ? ' (late)' : ''}`
  const grid = input.perPuzzleStars.map(starString).join(' ')
  const lines = [headline, `${grid} — ${formatTime(input.totalDurationMs)}`]
  if (!input.late && input.streak >= 2) {
    lines.push(`🔥 ${input.streak}-day streak`)
  }
  lines.push(SITE_URL)
  return lines.join('\n')
}
```

- [ ] **Step 4: Update the two call sites in `src/routes/play.tsx`**

Replace `handleShare` and its callers:

```ts
  const handleShare = async (input: {
    dayNumber: number
    perPuzzleStars: Array<1 | 2 | 3>
    totalDurationMs: number
    streak: number
  }) => {
    const result = await shareSession(input)
    if (result === 'failed') {
      setShareFallbackText(formatShareString(input))
    }
  }
```

ScorecardLock branch (`onShare` prop value):

```ts
          onShare={() => {
            const stored = loadStorage()
            void handleShare({
              dayNumber: dn,
              perPuzzleStars: existingResult.perPuzzle.map((p) => p.stars),
              totalDurationMs: existingResult.totalDurationMs,
              streak: stored.streak.current,
            })
          }}
```

First-run branch (`onScorecardPrimary` prop value):

```ts
          onScorecardPrimary={() => {
            const stored = loadStorage()
            const session = stored.sessions[startDate]
            if (!session) return
            void handleShare({
              dayNumber: dn,
              perPuzzleStars: session.perPuzzle.map((p) => p.stars),
              totalDurationMs: session.totalDurationMs,
              streak: stored.streak.current,
            })
          }}
```

- [ ] **Step 5: Verify**

Run: `npx vitest run tests/daily/share.test.ts` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/daily/share.ts src/routes/play.tsx tests/daily/share.test.ts
git commit -m "Share v2: per-puzzle star grid, streak line, (late) marker for makeups"
```

---

### Task 5: useEasternDate + useDailyStorage hooks

**Files:**
- Create: `src/daily/useEasternDate.ts`
- Create: `src/daily/useDailyStorage.ts`
- Test: `tests/daily/rollover.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `tests/daily/rollover.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEasternDate } from '@/daily/useEasternDate'

describe('useEasternDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the current Eastern date', () => {
    // 2026-07-02 12:00 EDT == 16:00 UTC
    vi.setSystemTime(new Date('2026-07-02T16:00:00Z'))
    const { result } = renderHook(() => useEasternDate())
    expect(result.current).toBe('2026-07-02')
  })

  it('flips to the next date when Eastern midnight passes', () => {
    // 23:59:30 EDT on Jul 2 == 03:59:30 UTC Jul 3
    vi.setSystemTime(new Date('2026-07-03T03:59:30Z'))
    const { result } = renderHook(() => useEasternDate())
    expect(result.current).toBe('2026-07-02')
    act(() => {
      vi.advanceTimersByTime(31_000) // past midnight + the 250ms cushion
    })
    expect(result.current).toBe('2026-07-03')
  })

  it('re-checks when the tab becomes visible again', () => {
    vi.setSystemTime(new Date('2026-07-03T03:59:30Z'))
    const { result } = renderHook(() => useEasternDate())
    expect(result.current).toBe('2026-07-02')
    // Simulate the device sleeping through midnight: jump the clock without
    // letting the timeout fire, then fire visibilitychange.
    vi.setSystemTime(new Date('2026-07-03T05:00:00Z'))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe('2026-07-03')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/daily/rollover.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the hooks**

Create `src/daily/useEasternDate.ts`:

```ts
import { useEffect, useState } from 'react'
import { easternDateString, msUntilNextRollover } from './date'

/**
 * The current Eastern calendar date, kept live across midnight. A timeout
 * fires just past the rollover; a visibilitychange re-check covers device
 * sleep outlasting any timer. Consumers re-render exactly once per flip.
 */
export function useEasternDate(): string {
  const [date, setDate] = useState(() => easternDateString())

  useEffect(() => {
    let timer: number | undefined

    const sync = () => {
      const now = easternDateString()
      setDate((prev) => (prev === now ? prev : now))
      window.clearTimeout(timer)
      // +250ms cushion so we land safely on the far side of midnight.
      timer = window.setTimeout(sync, msUntilNextRollover() + 250)
    }

    timer = window.setTimeout(sync, msUntilNextRollover() + 250)
    const onVisibility = () => {
      if (!document.hidden) sync()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return date
}
```

Create `src/daily/useDailyStorage.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { loadStorage, saveStorage, STORAGE_KEY } from './storage'
import type { DailyStorage } from './types'

/**
 * Daily storage as React state, kept in sync across tabs. `storage` is null
 * until the first client-side read (SSR-safe). `update` applies a pure
 * transform, persists it, and returns the new value.
 */
export function useDailyStorage(): {
  storage: DailyStorage | null
  update: (fn: (s: DailyStorage) => DailyStorage) => DailyStorage
  refresh: () => void
} {
  const [storage, setStorage] = useState<DailyStorage | null>(null)

  const refresh = useCallback(() => setStorage(loadStorage()), [])

  useEffect(() => {
    refresh()
    const onStorage = (e: StorageEvent) => {
      // key === null means "storage cleared"; refresh for that too.
      if (e.key === STORAGE_KEY || e.key === null) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const update = useCallback((fn: (s: DailyStorage) => DailyStorage) => {
    const next = fn(loadStorage())
    saveStorage(next)
    setStorage(next)
    return next
  }, [])

  return { storage, update, refresh }
}
```

- [ ] **Step 4: Verify** — `npx vitest run tests/daily/rollover.test.ts` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/daily/useEasternDate.ts src/daily/useDailyStorage.ts tests/daily/rollover.test.ts
git commit -m "Add useEasternDate (midnight rollover) and useDailyStorage (cross-tab sync) hooks"
```

---

### Task 6: FlipWords resume props

**Files:**
- Modify: `src/components/FlipWords.tsx`
- Test: `tests/components/flipwords-resume.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/components/flipwords-resume.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import FlipWords from '@/components/FlipWords'
import { allLevels } from '@/game/levels'
import type { PuzzleResult } from '@/daily/types'

const doneResult = (): PuzzleResult => ({
  attempts: 1,
  hints: 0,
  durationMs: 30_000,
  stars: 3,
})

// matchMedia isn't implemented in jsdom; several children query it.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  })
})

describe('FlipWords resume', () => {
  it('starts at the puzzle after the last completed one', () => {
    const session = allLevels.slice(0, 5)
    render(
      <FlipWords
        session={session}
        mode="daily"
        date="2026-07-02"
        dayNumber={46}
        initialProgress={{
          puzzlesDone: [doneResult(), doneResult(), doneResult()],
          elapsedMs: 200_000,
        }}
      />
    )
    // Chin shows "4 of 5" — puzzle index resumed at 3 (0-based).
    expect(screen.getByText('4')).toBeDefined()
    expect(screen.getByText('of 5')).toBeDefined()
  })

  it('starts at puzzle 1 without initialProgress', () => {
    const session = allLevels.slice(0, 5)
    render(
      <FlipWords session={session} mode="daily" date="2026-07-02" dayNumber={46} />
    )
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('of 5')).toBeDefined()
  })
})
```

Add `import { beforeAll } from 'vitest'` to the import line (i.e. `import { describe, it, expect, vi, beforeAll } from 'vitest'`).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/components/flipwords-resume.test.tsx`
Expected: FAIL — `initialProgress` prop does not exist (TS error at render) / resumed index not honored.

- [ ] **Step 3: Implement in FlipWords.tsx**

3a. Extend `FlipWordsProps` (after the `showTutorial` field):

```ts
  /**
   * Resume seed: results for puzzles already completed this session plus the
   * timer snapshot. The component starts at puzzle `puzzlesDone.length`.
   */
  initialProgress?: { puzzlesDone: PuzzleResult[]; elapsedMs: number }
  /**
   * Progress report for host persistence — fired after each puzzle solve and
   * when the tab hides, always with currentIdx === puzzlesDone.length (capped
   * at the final puzzle so a resumed session never starts past the end).
   */
  onProgress?: (progress: {
    puzzlesDone: PuzzleResult[]
    currentIdx: number
    elapsedMs: number
  }) => void
```

Add `PuzzleResult` to the type import from `'@/daily/types'`.

3b. Destructure the new props in the component signature (`initialProgress`, `onProgress`).

3c. Seed state from `initialProgress` (only ever read on first mount):

- `levelIdx`: `useState(() => { const n = initialProgress?.puzzlesDone.length ?? 0; return Math.max(0, Math.min(n, session.length - 1)) })`
- `elapsedMs`: `useState(initialProgress?.elapsedMs ?? 0)`
- `perPuzzleRef`: `useRef<...>(initialProgress?.puzzlesDone.slice() ?? [])`
- `elapsedAccumRef`: `useRef(initialProgress?.elapsedMs ?? 0)`

3d. In the init-level effect, seed the session clock so `totalDurationMs` stays sane after resume — replace the `sessionStartRef` block with:

```ts
    if (sessionStartRef.current === null) {
      // On resume, backdate the start so total duration ≈ prior elapsed +
      // this run's wall time instead of counting the offline gap.
      sessionStartRef.current = Date.now() - elapsedAccumRef.current;
    }
```

3e. Guard the session-prop-change effect so it doesn't clobber the seed on mount:

```ts
  const sessionEffectRanRef = useRef(false);
  useEffect(() => {
    if (!sessionEffectRanRef.current) {
      sessionEffectRanRef.current = true;
      return; // mount — state initializers already did this work
    }
    setGameLevels(session)
    setLevelIdx(0)
    /* ...rest of the existing resets unchanged... */
  }, [session])
```

3f. Progress reporting. Near the other refs:

```ts
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const elapsedNowMs = () =>
    elapsedAccumRef.current +
    (visibleStartRef.current !== null ? Date.now() - visibleStartRef.current : 0);

  const reportProgress = useCallback(() => {
    if (!onProgressRef.current) return;
    // Cap at the final puzzle: a killed tab after the last solve resumes ON
    // the last puzzle rather than in an unrepresentable "6 of 5" state.
    const done = perPuzzleRef.current.slice(0, 4);
    onProgressRef.current({
      puzzlesDone: done.slice(),
      currentIdx: done.length,
      elapsedMs: elapsedNowMs(),
    });
  }, []);
```

In `runWinSequence`, right after `perPuzzleRef.current.push({...})`, add `reportProgress();` (and add `reportProgress` to the `useCallback` dep array).

In the session-timer effect, inside `handleVisibility`'s `document.hidden` branch (after banking the accumulator), add `reportProgress();`. Add a `pagehide` listener alongside:

```ts
    const handlePageHide = () => {
      if (visibleStartRef.current !== null) {
        elapsedAccumRef.current += Date.now() - visibleStartRef.current;
        visibleStartRef.current = null;
      }
      reportProgress();
    };
    window.addEventListener("pagehide", handlePageHide);
```

(and remove it in the cleanup; add `reportProgress` to the effect deps).

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/components/flipwords-resume.test.tsx` → PASS
Run: `npm test` → all pass. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/FlipWords.tsx tests/components/flipwords-resume.test.tsx
git commit -m "FlipWords: initialProgress/onProgress for host-driven session resume"
```

---

### Task 7: Play route — resume wiring + rollover CTA

**Files:**
- Modify: `src/routes/play.tsx`

- [ ] **Step 1: Wire resume + progress persistence**

In `src/routes/play.tsx`:

Imports to add:

```ts
import { readProgress, writeProgress } from '@/daily/progress'
import { useEasternDate } from '@/daily/useEasternDate'
```

Make `startDate` resettable and derive resume state from it:

```ts
  const [startDate, setStartDate] = useState(() => easternDateString())
  const liveToday = useEasternDate()
  const session = useMemo(() => getSessionForDate(startDate), [startDate])
  const dn = dayNumber(startDate)

  const resume = useMemo(() => {
    const p = readProgress(loadStorage(), startDate, 'daily')
    return p ? { puzzlesDone: p.puzzlesDone, elapsedMs: p.elapsedMs } : null
  }, [startDate])

  const handleProgress = (p: {
    puzzlesDone: PuzzleResult[]
    currentIdx: number
    elapsedMs: number
  }) => {
    saveStorage(writeProgress(loadStorage(), startDate, 'daily', p))
  }
```

Add `PuzzleResult` to the type import from `'@/daily/types'`.

`handleComplete` already persists via `recordCompletion` (which now clears the matching `inProgress`) — no change needed.

In the first-run (daily) `<FlipWords>`, add:

```tsx
          key={`daily-${startDate}`}
          initialProgress={resume ?? undefined}
          onProgress={handleProgress}
```

- [ ] **Step 2: Rollover CTA on the done state**

Add a "new day" reset handler next to `handlePractice`:

```ts
  const handlePlayToday = () => {
    const today = easternDateString()
    setPracticeMode(false)
    setStartDate(today)
    setExistingResult(loadStorage().sessions[today] ?? null)
  }
```

Extend `ScorecardLock`'s props with `newDayAvailable: boolean` and `onPlayToday: () => void`, pass them from the done branch:

```tsx
        <ScorecardLock
          result={existingResult}
          newDayAvailable={liveToday !== startDate}
          onPlayToday={handlePlayToday}
          ...
```

Inside `ScorecardLock`'s footer button stack, render before the practice button:

```tsx
        {newDayAvailable && (
          <button
            onClick={onPlayToday}
            className="pointer-events-auto font-ui flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-full text-sm shadow-tile-lift active:scale-95"
          >
            <span className="material-icons text-[18px]">wb_sunny</span>
            A new puzzle is ready — play now
          </button>
        )}
```

- [ ] **Step 3: Verify**

`npx tsc --noEmit` → clean. `npm test` → all pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/play.tsx
git commit -m "Play route: resume in-progress daily, persist progress, new-day CTA on done state"
```

---

### Task 8: Archive makeup — route modes + calendar

**Files:**
- Modify: `src/routes/archive_.$date.tsx`
- Modify: `src/components/Archive.tsx`

- [ ] **Step 1: Rewrite the replay route with mode selection**

Replace the body of `src/routes/archive_.$date.tsx` with:

```tsx
import { useEffect, useMemo } from 'react'
import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import FlipWords from '@/components/FlipWords'
import { getSessionForDate } from '@/daily/schedule'
import { dayNumber, LAUNCH_DATE, easternDateString } from '@/daily/date'
import { loadStorage, saveStorage } from '@/daily/storage'
import { recordCompletion } from '@/daily/streak'
import { readProgress, writeProgress } from '@/daily/progress'
import type { PuzzleResult, SessionResult } from '@/daily/types'

export const Route = createFileRoute('/archive_/$date')({
  component: ArchiveReplay,
})

function ArchiveReplay() {
  const navigate = useNavigate()
  const { date } = useParams({ from: '/archive_/$date' })
  const today = easternDateString()

  // Today's puzzle belongs on /play where streaks and locking live.
  useEffect(() => {
    if (date === today) navigate({ to: '/play', replace: true })
  }, [date, today, navigate])

  // A missed day (no stored result) is a MAKEUP: it records a real result
  // that counts toward totals but never the streak. An already-played day
  // replays as practice — nothing is recorded.
  const alreadyPlayed = !!loadStorage().sessions[date]

  const resume = useMemo(() => {
    if (alreadyPlayed) return null
    const p = readProgress(loadStorage(), date, 'makeup')
    return p ? { puzzlesDone: p.puzzlesDone, elapsedMs: p.elapsedMs } : null
  }, [date, alreadyPlayed])

  // Guardrails: refuse pre-launch and future dates.
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
  if (date === today) return null // redirecting

  const session = getSessionForDate(date)
  const dn = dayNumber(date)

  const handleMakeupComplete = (result: SessionResult) => {
    saveStorage(recordCompletion(loadStorage(), date, result, 'makeup'))
  }
  const handleMakeupProgress = (p: {
    puzzlesDone: PuzzleResult[]
    currentIdx: number
    elapsedMs: number
  }) => {
    saveStorage(writeProgress(loadStorage(), date, 'makeup', p))
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
      <FlipWords
        key={`archive-${date}-${alreadyPlayed ? 'practice' : 'makeup'}`}
        session={session}
        mode="archive"
        date={date}
        dayNumber={dn}
        initialProgress={resume ?? undefined}
        onProgress={alreadyPlayed ? undefined : handleMakeupProgress}
        onComplete={alreadyPlayed ? undefined : handleMakeupComplete}
        scorecardPrimaryLabel="Back to archive"
        scorecardPrimaryIcon="history"
        onScorecardPrimary={() => navigate({ to: '/archive' })}
        onBack={() => navigate({ to: '/archive' })}
      />
    </div>
  )
}
```

- [ ] **Step 2: Calendar — tappable missed cells + late glyph + legend**

In `src/components/Archive.tsx`, `DayCell`:

Replace the `isMissed` style branch and tappability:

```ts
  } else if (isMissed) {
    cls +=
      'text-ink-soft cursor-pointer border border-dashed border-paper-line ' +
      'hover:border-accent hover:text-ink transition-colors ' +
      '[background:oklch(94%_0.012_85_/_0.45)]'
  }
```

```ts
  const tappable = !isFuture && !isPreLaunch
```

Add the late glyph inside the button, after the star row (renders only for makeup results):

```tsx
      {stored?.mode === 'makeup' && (
        <span
          className="material-icons absolute top-0.5 right-0.5 text-ink-soft"
          style={{ fontSize: 8 }}
          aria-label="Played late"
        >
          history
        </span>
      )}
```

Add `relative` to the base `cls` string start: `'aspect-square rounded-[5px] relative flex flex-col ...'`.

Append a fourth legend item after "Missed":

```tsx
          <span className="inline-flex items-center gap-1.5">
            <span className="material-icons text-ink-soft" style={{ fontSize: 12 }}>
              history
            </span>
            Late
          </span>
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `npm test` all pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/archive_.\$date.tsx src/components/Archive.tsx
git commit -m "Archive: missed days playable as makeups (totals yes, streak no), late glyph"
```

---

### Task 9: TitleScreen + Archive — live date and storage sync

**Files:**
- Modify: `src/components/TitleScreen.tsx`
- Modify: `src/components/Archive.tsx`

- [ ] **Step 1: TitleScreen live date + sync + new-puzzle pulse**

In `src/components/TitleScreen.tsx`:

Imports: add

```ts
import { motion } from 'framer-motion'
import { useEasternDate } from '@/daily/useEasternDate'
import { useDailyStorage } from '@/daily/useDailyStorage'
```

(`motion` may already be imported — keep one import.)

Replace the date + storage state block:

```ts
  const today = useEasternDate()
  const dn = dayNumber(today)

  // Live storage with cross-tab sync. Settle the streak whenever the date
  // changes (mount + midnight rollover) so a missed-day reset shows at once.
  const { storage, update } = useDailyStorage()
  useEffect(() => {
    update((s) => settleStreak(s, today))
  }, [today, update])
```

Remove the old `useState<DailyStorage | null>` + settle effect and the now-unused `loadStorage`/`saveStorage`/`DailyStorage` imports.

New-puzzle pulse — replace the `No. {formatPuzzleNumber(dn)}` paragraph with a keyed motion element so the number pops when the day flips:

```tsx
            <motion.p
              key={dn}
              initial={{ scale: 0.9, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 22 }}
              className="font-wide text-[44px] md:text-[46px] text-ink leading-none tracking-[-0.01em]"
            >
              No. {formatPuzzleNumber(dn)}
            </motion.p>
```

- [ ] **Step 2: Archive live date + sync**

In `src/components/Archive.tsx`:

```ts
import { useEasternDate } from '@/daily/useEasternDate'
import { useDailyStorage } from '@/daily/useDailyStorage'
```

Replace `const today = easternDateString()` with `const today = useEasternDate()` and replace the local storage state + effect with:

```ts
  const { storage } = useDailyStorage()
```

(Delete the `loadStorage` import and the old `useEffect`.) Everything downstream reads `storage` the same way.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `npm test` all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/TitleScreen.tsx src/components/Archive.tsx
git commit -m "TitleScreen/Archive: live Eastern date, cross-tab storage sync, new-puzzle pulse"
```

---

### Task 10: Full regression + live browser verification

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run: `npm test` → all pass. `npx tsc --noEmit` → clean.
Run: `python3 tools/verify_levels.py` → all 151 levels OK (unchanged, sanity).

- [ ] **Step 2: Browser — resume**

Start dev server (preview tools, port 3457). In the browser:
1. Clear localStorage; open `/play`; solve puzzles 1 and 2 (use the session solutions from `getSessionForDate` via module import in eval).
2. Reload the page. Expected: chin shows `3 of 5`, timer continues from where it was (not 0:00).
3. Solve through to completion. Expected: scorecard; `loadStorage().inProgress === null`; session recorded with `mode: 'daily'`.

- [ ] **Step 3: Browser — v1 migration**

In eval: write a v1 blob (`schemaVersion: 1`, one session with `isDailyResult: true`) to `flipwords_daily_v1`, reload `/`. Expected: stats render, `loadStorage().schemaVersion === 2`, session has `mode: 'daily'`.

- [ ] **Step 4: Browser — makeup flow**

1. Open `/archive`; tap a Missed day. Expected: navigates to `/archive/<date>` and the board renders.
2. Solve puzzle 1, reload — resumes at puzzle 2 (makeup resume).
3. Complete all 5. Expected: scorecard; back on `/archive` the cell now shows stars + the tiny `history` glyph; Played count incremented; streak unchanged.

- [ ] **Step 5: Browser — share + console sweep**

On a completed day's lock screen, trigger share with clipboard denied (eval overrides `navigator.clipboard`), confirm the fallback modal shows the new multi-line format. Check `preview_console_logs` for zero new errors.

- [ ] **Step 6: Commit any verification fixes; final commit if needed**

```bash
git status   # should be clean of source changes at this point
```
