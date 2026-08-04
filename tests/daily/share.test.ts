import { describe, it, expect } from 'vitest'
import { formatShareString } from '@/daily/share'
import { EDITIONS } from '@/edition'

const ED = EDITIONS.flipwords

const FIVE_STARS: Array<1 | 2 | 3> = [3, 2, 3, 3, 3]

describe('formatShareString', () => {
  it('daily result with streak >= 2 includes the streak line', () => {
    expect(
      formatShareString(ED, {
        dayNumber: 46,
        perPuzzleStars: FIVE_STARS,
        totalDurationMs: 211_000,
        streak: 12,
      })
    ).toBe(
      'FLIPWORDS No. 046\n★★★ ★★☆ ★★★ ★★★ ★★★ — 3:31\n🔥 12-day streak\nflipwords.superfun.games'
    )
  })

  it('streak of 1 (or 0) omits the streak line', () => {
    expect(
      formatShareString(ED, {
        dayNumber: 46,
        perPuzzleStars: FIVE_STARS,
        totalDurationMs: 211_000,
        streak: 1,
      })
    ).toBe(
      'FLIPWORDS No. 046\n★★★ ★★☆ ★★★ ★★★ ★★★ — 3:31\nflipwords.superfun.games'
    )
  })

  it('makeup result is marked (late) and never shows a streak line', () => {
    expect(
      formatShareString(ED, {
        dayNumber: 38,
        perPuzzleStars: [1, 2, 2, 3, 3],
        totalDurationMs: 611_000,
        streak: 12,
        late: true,
      })
    ).toBe(
      'FLIPWORDS No. 038 (late)\n★☆☆ ★★☆ ★★☆ ★★★ ★★★ — 10:11\nflipwords.superfun.games'
    )
  })

  it('pads small day numbers to 3 digits, leaves large ones alone', () => {
    const base = { perPuzzleStars: FIVE_STARS, totalDurationMs: 60_000, streak: 0 }
    expect(formatShareString(ED, { ...base, dayNumber: 7 })).toContain('No. 007')
    expect(formatShareString(ED, { ...base, dayNumber: 1234 })).toContain('No. 1234')
  })
})
