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
