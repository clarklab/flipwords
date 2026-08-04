import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import FlipWords from '@/components/FlipWords'
import { EDITIONS, EditionProvider } from '@/edition'
import type { PuzzleResult } from '@/daily/types'

const doneResult = (): PuzzleResult => ({
  attempts: 1,
  hints: 0,
  durationMs: 30_000,
  stars: 3,
})

// matchMedia isn't implemented in jsdom; several children query it.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  })
})

describe('FlipWords resume', () => {
  it('starts at the puzzle after the last completed one', () => {
    const session = EDITIONS.flipwords.levels.slice(0, 5)
    render(
      <EditionProvider value="flipwords">
      <FlipWords
        session={session}
        mode="daily"
        date="2026-07-02"
        dayNumber={46}
        initialProgress={{
          puzzlesDone: [doneResult(), doneResult(), doneResult()],
          elapsedMs: 200_000,
        }}
      />
      </EditionProvider>
    )
    // Chin shows "4 of 5" — puzzle index resumed at 3 (0-based).
    expect(screen.getByText('4')).toBeDefined()
    expect(screen.getByText('of 5')).toBeDefined()
  })

  it('starts at puzzle 1 without initialProgress', () => {
    const session = EDITIONS.flipwords.levels.slice(0, 5)
    render(
      <EditionProvider value="flipwords">
        <FlipWords session={session} mode="daily" date="2026-07-02" dayNumber={46} />
      </EditionProvider>
    )
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('of 5')).toBeDefined()
  })
})
