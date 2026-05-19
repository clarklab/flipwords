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
