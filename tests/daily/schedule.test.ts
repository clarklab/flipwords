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
