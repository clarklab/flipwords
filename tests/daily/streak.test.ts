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
