import { describe, it, expect } from 'vitest'
import { formatShareString } from '@/daily/share'

describe('formatShareString', () => {
  it('3-star session', () => {
    expect(
      formatShareString({ dayNumber: 42, stars: 3, totalDurationMs: 252_000 })
    ).toBe('FlipWords No. 042\n★★★ — 4:12\nflipwords.superfun.games')
  })

  it('2-star session', () => {
    expect(
      formatShareString({ dayNumber: 42, stars: 2, totalDurationMs: 348_000 })
    ).toBe('FlipWords No. 042\n★★☆ — 5:48\nflipwords.superfun.games')
  })

  it('1-star session', () => {
    expect(
      formatShareString({ dayNumber: 42, stars: 1, totalDurationMs: 570_000 })
    ).toBe('FlipWords No. 042\n★☆☆ — 9:30\nflipwords.superfun.games')
  })

  it('pads small numbers to 3 digits', () => {
    expect(
      formatShareString({ dayNumber: 7, stars: 3, totalDurationMs: 60_000 })
    ).toBe('FlipWords No. 007\n★★★ — 1:00\nflipwords.superfun.games')
  })

  it('does not pad large numbers', () => {
    expect(
      formatShareString({ dayNumber: 1234, stars: 3, totalDurationMs: 60_000 })
    ).toBe('FlipWords No. 1234\n★★★ — 1:00\nflipwords.superfun.games')
  })

  it('formats sub-minute times correctly', () => {
    expect(
      formatShareString({ dayNumber: 1, stars: 3, totalDurationMs: 5_000 })
    ).toBe('FlipWords No. 001\n★★★ — 0:05\nflipwords.superfun.games')
  })
})
