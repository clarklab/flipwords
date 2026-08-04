import { describe, it, expect } from 'vitest'
import { getSessionForDate, poolForDate } from '@/daily/schedule'
import { EDITIONS } from '@/edition'

const ED = EDITIONS.flipwords

describe('getSessionForDate', () => {
  it('returns 5 levels', () => {
    expect(getSessionForDate(ED, '2026-05-19')).toHaveLength(5)
  })

  it('is deterministic — same date returns the same sequence', () => {
    const a = getSessionForDate(ED, '2026-05-19').map((l) => l.id)
    const b = getSessionForDate(ED, '2026-05-19').map((l) => l.id)
    expect(a).toEqual(b)
  })

  it('different dates return different sequences (high probability)', () => {
    const a = getSessionForDate(ED, '2026-05-19').map((l) => l.id).join(',')
    const b = getSessionForDate(ED, '2026-05-20').map((l) => l.id).join(',')
    expect(a).not.toBe(b)
  })

  it('preserves the tier curve — last level requires rotation', () => {
    const session = getSessionForDate(ED, '2026-05-19')
    expect(session[4].requiresRotation).toBe(true)
  })

  it('preserves the tier curve — first two levels are tier 1', () => {
    const session = getSessionForDate(ED, '2026-05-19')
    expect(session[0].tier ?? 1).toBe(1)
    expect(session[1].tier ?? 1).toBe(1)
  })

  it('NEVER rewrites history — pinned sessions for already-played dates', () => {
    // These are the exact sessions the game served while the pool was 101
    // levels. They are load-bearing: players played them and the archive
    // replays them. If this test fails, a pool change leaked into the past —
    // fix the POOL_RELEASES gating, do NOT update these snapshots.
    const pinned: Record<string, number[]> = {
      '2026-05-18': [12, 2, 84, 100, 43],
      '2026-05-19': [11, 76, 18, 91, 96],
      '2026-06-01': [52, 71, 83, 21, 98],
      '2026-06-15': [8, 54, 19, 31, 93],
      '2026-07-01': [5, 15, 36, 39, 99],
      '2026-07-02': [63, 54, 18, 16, 51],
    }
    for (const [date, ids] of Object.entries(pinned)) {
      expect(getSessionForDate(ED, date).map((l) => l.id), date).toEqual(ids)
    }
  })

  it('pre-release dates never draw from later-released levels', () => {
    for (let i = 0; i < 46; i++) {
      const d = new Date(Date.UTC(2026, 4, 18 + i)).toISOString().slice(0, 10)
      const ids = getSessionForDate(ED, d).map((l) => l.id)
      expect(Math.max(...ids), d).toBeLessThanOrEqual(101)
    }
  })

  it('post-release dates can draw the newer levels', () => {
    expect(poolForDate(ED, '2026-07-03')).toHaveLength(151)
    let sawNew = false
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.UTC(2026, 6, 3 + i)).toISOString().slice(0, 10)
      if (getSessionForDate(ED, d).some((l) => l.id > 101)) sawNew = true
    }
    expect(sawNew).toBe(true)
  })

  it('every produced session is solvable by its declared solution', () => {
    // Sample 20 dates across the calendar
    for (let i = 0; i < 20; i++) {
      const session = getSessionForDate(ED, `2026-05-${String(19 + i).padStart(2, '0')}`)
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
