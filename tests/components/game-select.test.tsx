import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GameSelect from '@/components/GameSelect'
import { EDITIONS, EDITION_IDS } from '@/edition'

describe('GameSelect (the fork in the road)', () => {
  it('offers every edition by name and explains the two-name situation', () => {
    render(<GameSelect onChoose={() => {}} />)
    expect(screen.getByText('One game, two names')).toBeDefined()
    for (const id of EDITION_IDS) {
      expect(screen.getByText(EDITIONS[id].name)).toBeDefined()
      expect(
        screen.getByRole('button', { name: `Play ${EDITIONS[id].name}` })
      ).toBeDefined()
    }
  })

  it('reports the picked edition id', () => {
    const onChoose = vi.fn()
    render(<GameSelect onChoose={onChoose} />)
    for (const id of EDITION_IDS) {
      fireEvent.click(
        screen.getByRole('button', { name: `Play ${EDITIONS[id].name}` })
      )
      expect(onChoose).toHaveBeenLastCalledWith(id)
    }
    expect(onChoose).toHaveBeenCalledTimes(EDITION_IDS.length)
  })

  it('marks the current edition, and only when one exists', () => {
    const { rerender } = render(<GameSelect onChoose={() => {}} />)
    expect(screen.queryByText('Now playing')).toBeNull()

    rerender(<GameSelect onChoose={() => {}} current="flipwords" />)
    const badge = screen.getByText('Now playing')
    expect(
      badge.closest('button')?.getAttribute('aria-label')
    ).toBe(`Play ${EDITIONS.flipwords.name}`)
  })
})
