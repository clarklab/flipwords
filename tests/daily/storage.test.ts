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
