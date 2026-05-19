import { describe, it, expect } from 'vitest'
import { easternDateString, dayNumber, shiftDate, msUntilNextRollover, LAUNCH_DATE } from '@/daily/date'

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

describe('dayNumber', () => {
  it('launch date is day 1', () => {
    expect(dayNumber(LAUNCH_DATE)).toBe(1)
  })

  it('one day after launch is day 2', () => {
    // LAUNCH_DATE is '2026-05-18' — day 2 is '2026-05-19'
    expect(dayNumber('2026-05-19')).toBe(2)
  })

  it('returns 0 or negative for pre-launch dates', () => {
    expect(dayNumber('2026-05-17')).toBe(0)
    expect(dayNumber('2026-05-16')).toBe(-1)
  })

  it('handles month and year boundaries', () => {
    // 14 days after May 18 = June 1 → day 15
    expect(dayNumber('2026-06-01')).toBe(15)
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
