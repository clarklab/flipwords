# Robust Daily Play — Design

**Date:** 2026-07-02
**Status:** Approved by Clark (scope: all 5 areas; resume at puzzle boundaries; makeup counts toward totals but never streak; storage v2 with host-driven progress)

## Goal

Harden the daily loop so nothing a player does — refreshing mid-session, missing a day,
leaving a tab open past midnight, opening two tabs, or upgrading the app — loses their
progress or their history. Add catch-up play for missed days and a more shareable result
format.

## Current gaps (audited 2026-07-02)

1. No mid-session persistence: refresh or tab eviction during the daily restarts it from
   puzzle 1 with the timer reset.
2. Missed archive days are permanently dead: calendar "Missed" cells are un-tappable, and
   the replay route discards results (no `onComplete`).
3. Midnight rollover is unhandled: title screen day number/CTA/stats go stale; the
   countdown wraps silently.
4. Storage is fragile: an unknown `schemaVersion` silently wipes all data; two tabs
   clobber each other.
5. Share string has no per-puzzle detail or streak.

## 1. Storage v2

`src/daily/types.ts` / `src/daily/storage.ts`

```ts
type StoredSession = {
  completedAt: number
  stars: 1 | 2 | 3
  perPuzzle: PuzzleResult[]
  totalDurationMs: number
  mode: 'daily' | 'makeup'          // replaces isDailyResult: true
}

type InProgressSession = {
  date: EasternDate
  mode: 'daily' | 'makeup'
  puzzlesDone: PuzzleResult[]       // results for COMPLETED puzzles only
  currentIdx: number                // index of the puzzle being played
  elapsedMs: number                 // session timer snapshot
  startedAt: number
  updatedAt: number
}

type DailyStorage = {
  schemaVersion: 2
  streak: StreakState               // unchanged
  sessions: { [date: EasternDate]: StoredSession }
  totals: { sessionsPlayed: number; perfectSessions: number }  // both modes count
  inProgress: InProgressSession | null   // at most one, latest wins
}
```

**Migration policy** (`loadStorage`):

- v1 → v2: map `isDailyResult: true` → `mode: 'daily'`, add `inProgress: null`.
- Unknown/newer version: copy the raw blob to `flipwords_daily_backup` BEFORE starting
  fresh. Never silently destroy data.
- Migration is pure and unit-tested; `loadStorage` always returns a valid v2 object.

**Cross-tab sync:** a `useStorageSync()` hook subscribes to the `window` `storage` event
and re-reads storage when another tab writes it. Title screen, archive, and the play
route's "already done" branch consume it. `recordCompletion` stays idempotent, so a
race where two tabs finish the same day is a no-op for the second writer.

## 2. Mid-session resume (puzzle boundaries)

`FlipWords` gains two optional props (host-driven; the component stays
persistence-agnostic):

```ts
initialProgress?: { puzzlesDone: PuzzleResult[]; elapsedMs: number }
onProgress?: (p: { puzzlesDone: PuzzleResult[]; elapsedMs: number; currentIdx: number }) => void
```

- `initialProgress` seeds `levelIdx`, `perPuzzleRef`, and the elapsed-time accumulator.
- `onProgress` fires (a) after each puzzle solve, and (b) on `pagehide` /
  `visibilitychange`-hidden with just the elapsed-time update, so the timer survives
  eviction mid-puzzle.
- The play route writes `onProgress` payloads into `storage.inProgress` (mode `daily`,
  keyed to the route's snapshotted `startDate`) and clears `inProgress` inside
  `handleComplete`.
- On mount, the play route resumes when `inProgress` exists with `mode === 'daily'` and
  `date === startDate`; anything else stale is discarded (cleared on next write).
- Resume granularity is the puzzle boundary: finished puzzles + timer are restored; the
  puzzle that was underway restarts fresh (tiles re-shuffle; the dev-time level audit and
  `sanitizeState` make partially-restored board state unnecessary).
- Validation on read: `puzzlesDone.length === currentIdx`, `currentIdx` in `0..4`,
  results well-formed — otherwise treat as absent.
- Archive makeup sessions (below) use the same mechanism with `mode: 'makeup'` and the
  archive date.

## 3. Archive catch-up ("makeup" days)

- Calendar `DayCell`: missed cells become tappable and navigate to the replay route.
  Legend gains a fourth state. Made-up days render like played days plus a small "late"
  glyph (Material `history`, 9px, corner of the cell).
- Replay route (`archive_.$date.tsx`) chooses a mode:
  - `date === today` → redirect to `/play`.
  - `sessions[date]` exists → **practice** replay (today's behavior, nothing recorded).
  - otherwise → **makeup**: passes `onComplete`, which calls
    `recordCompletion(storage, date, result, 'makeup')`.
- `recordCompletion(s, date, result, mode)`:
  - `mode === 'daily'`: unchanged — ticks streak, records session, bumps totals.
  - `mode === 'makeup'`: records session with `mode: 'makeup'`, bumps
    `sessionsPlayed`/`perfectSessions`, **never touches streak**.
  - Remains idempotent per date.
- Makeup completions show the normal scorecard (no streak chip) with "Back to archive"
  as the primary CTA.

## 4. Midnight rollover

New `useEasternDate()` hook in `src/daily/`:

- Returns the current Eastern date string; schedules a `setTimeout` for
  `msUntilNextRollover()` and re-checks on `visibilitychange` (device sleep can outlast
  any timer).
- Title screen: uses the hook for `today`; on change it re-settles the streak, refreshes
  day number/header/CTA, and pulses the hero card with a brief "New puzzle!" state
  (reduced-motion aware).
- Play route: an in-progress session keeps its snapshotted `startDate` (existing,
  correct behavior — finishing after midnight still records for the day you started).
  The "already done" scorecard lock swaps its footer CTA to "Play today's puzzle →"
  when the date changes.
- Archive: "today" ring and future-cell gating recompute from the hook.

## 5. Richer share

`formatShareString` gains per-puzzle detail and streak:

```
FLIPWORDS No. 046
★★★ ★★☆ ★★★ ★★★ ★★★ — 3:31
🔥 12-day streak
flipwords.superfun.games
```

- Line 2: one ★/☆ triplet per puzzle (from `perPuzzle`), space-separated, then time.
- Line 3 only when `streak.current >= 2` and the share is for a daily result.
- Makeup shares: `FLIPWORDS No. 038 (late)` and no streak line. (Makeup scorecards keep
  "Back to archive" as the primary CTA; the makeup share format applies wherever a share
  affordance exists for a makeup result — if none is added, the format is dormant but
  specified so `formatShareString` handles both modes.)
- Callers now pass `perPuzzle` and streak; the share entry points already read fresh
  storage, so this is plumbing only.

## Error handling

- All storage reads go through `loadStorage()` which cannot throw and always returns
  valid v2 shape (parse errors → backup + fresh).
- `inProgress` that fails validation is ignored and overwritten on next write.
- Rollover timer drift: `visibilitychange` re-check is the source of truth; the timeout
  is an optimization.

## Testing

- `tests/daily/storage.test.ts`: v1→v2 migration, unknown-version backup key, corrupt
  JSON, round-trip.
- `tests/daily/streak.test.ts`: makeup recording bumps totals but never streak;
  idempotency per mode.
- New `tests/daily/progress.test.ts`: inProgress write/resume/expiry/validation.
- New `tests/daily/rollover.test.ts`: `useEasternDate` with fake timers +
  visibility events.
- `tests/daily/share.test.ts`: new format, streak-line gating, makeup variant.
- Live browser verification: refresh mid-session and resume; play a missed day and see
  the calendar update; simulate midnight on the title screen.

## Out of scope

- Mid-puzzle board-state restoration (explicitly chosen against).
- Streak repair via makeup days (explicitly chosen against).
- PWA/offline support, notifications, server-side accounts.
