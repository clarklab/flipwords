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
