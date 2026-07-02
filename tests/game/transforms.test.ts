import { describe, expect, it } from 'vitest'
import {
  findSolutionTileForSlot,
  getBoardFaces,
  getEdges,
  getExpectedEdges,
  getTileFace,
  isLevelSolved,
  normalizeRotation,
  sanitizeState,
} from '@/game/transforms'
import type { Level, Slots, Tile } from '@/game/types'

const tile = (id: string, top: string, bottom: string, isFlipped = false): Tile => ({
  id,
  top,
  bottom,
  isFlipped,
})

const LEVEL: Level = {
  id: 999,
  tier: 1,
  requiresRotation: false,
  tiles: [
    { id: 't1', top: 'AIR', bottom: 'PORT' },
    { id: 't2', top: 'MAN', bottom: 'HOLE' },
    { id: 't3', top: 'OUT', bottom: 'MAN' },
    { id: 't4', top: 'PORT', bottom: 'BIRD' },
    { id: 't5', top: 'AIR', bottom: 'HOLE' },
  ],
  hints: { topRow: '', bottomRow: '', leftCol: '', rightCol: '' },
  solution: {
    slot0Top: 'AIR',
    slot0Bottom: 'PORT',
    slot1Top: 'MAN',
    slot1Bottom: 'HOLE',
  },
}

const ROTATED_LEVEL: Level = {
  ...LEVEL,
  id: 998,
  requiresRotation: true,
  // Player must build storage that, once rotated 90° CW, shows
  // AIR MAN / PORT HOLE. Storage = [MAN, HOLE / AIR, PORT] as columns:
  solution: {
    slot0Top: 'MAN',
    slot0Bottom: 'AIR',
    slot1Top: 'HOLE',
    slot1Bottom: 'PORT',
  },
}

describe('normalizeRotation', () => {
  it('maps any accumulated rotation onto 0/90/180/270', () => {
    expect(normalizeRotation(0)).toBe(0)
    expect(normalizeRotation(90)).toBe(90)
    expect(normalizeRotation(180)).toBe(180)
    expect(normalizeRotation(270)).toBe(270)
    expect(normalizeRotation(360)).toBe(0)
    expect(normalizeRotation(450)).toBe(90)
    expect(normalizeRotation(720 + 270)).toBe(270)
    expect(normalizeRotation(90 * 41)).toBe(normalizeRotation(90))
  })

  it('handles negative (counter-clockwise) rotation', () => {
    expect(normalizeRotation(-90)).toBe(270)
    expect(normalizeRotation(-180)).toBe(180)
    expect(normalizeRotation(-360)).toBe(0)
    expect(normalizeRotation(-450)).toBe(270)
  })
})

describe('getTileFace', () => {
  it('returns storage order when not flipped and swapped when flipped', () => {
    expect(getTileFace(tile('a', 'AIR', 'PORT'))).toEqual({ top: 'AIR', bottom: 'PORT' })
    expect(getTileFace(tile('a', 'AIR', 'PORT', true))).toEqual({ top: 'PORT', bottom: 'AIR' })
  })

  it('double flip is identity', () => {
    const t = tile('a', 'AIR', 'PORT')
    const once = { ...t, isFlipped: !t.isFlipped }
    const twice = { ...once, isFlipped: !once.isFlipped }
    expect(getTileFace(twice)).toEqual(getTileFace(t))
  })
})

describe('getBoardFaces', () => {
  const slots: Slots = [tile('a', 'AIR', 'PORT'), tile('b', 'MAN', 'HOLE')]

  it('rotation 0 mirrors storage', () => {
    expect(getBoardFaces(slots, 0)).toEqual({
      topLeft: 'AIR',
      topRight: 'MAN',
      bottomLeft: 'PORT',
      bottomRight: 'HOLE',
    })
  })

  it('rotation 90 CW moves storage bottom-left to screen top-left', () => {
    expect(getBoardFaces(slots, 90)).toEqual({
      topLeft: 'PORT',
      topRight: 'AIR',
      bottomLeft: 'HOLE',
      bottomRight: 'MAN',
    })
  })

  it('rotation 180 reverses the board', () => {
    expect(getBoardFaces(slots, 180)).toEqual({
      topLeft: 'HOLE',
      topRight: 'PORT',
      bottomLeft: 'MAN',
      bottomRight: 'AIR',
    })
  })

  it('rotation 270 is the inverse of 90', () => {
    expect(getBoardFaces(slots, 270)).toEqual({
      topLeft: 'MAN',
      topRight: 'HOLE',
      bottomLeft: 'AIR',
      bottomRight: 'PORT',
    })
  })

  it('is invariant under full turns — the board can rotate forever', () => {
    for (const base of [0, 90, 180, 270]) {
      for (const turns of [-3, -2, -1, 1, 2, 5, 10]) {
        expect(getBoardFaces(slots, base + 360 * turns)).toEqual(
          getBoardFaces(slots, base)
        )
      }
    }
  })

  it('four consecutive quarter-turns return to the original faces', () => {
    let faces = getBoardFaces(slots, 0)
    expect(getBoardFaces(slots, 360)).toEqual(faces)
    // And each intermediate quarter-turn is consistent with rotating the
    // previous quarter-turn's screen positions once more.
    const r90 = getBoardFaces(slots, 90)
    const r180 = getBoardFaces(slots, 180)
    expect(r180.topLeft).toBe(r90.bottomLeft)
    expect(r180.topRight).toBe(r90.topLeft)
    expect(r180.bottomLeft).toBe(r90.bottomRight)
    expect(r180.bottomRight).toBe(r90.topRight)
  })

  it('flipping a slot tile swaps only that column, at any rotation', () => {
    const flipped: Slots = [tile('a', 'AIR', 'PORT', true), tile('b', 'MAN', 'HOLE')]
    expect(getBoardFaces(flipped, 0)).toEqual({
      topLeft: 'PORT',
      topRight: 'MAN',
      bottomLeft: 'AIR',
      bottomRight: 'HOLE',
    })
    // A flip commutes with rotation: flip-then-rotate === rotate-then-flip.
    for (const r of [0, 90, 180, 270, 450, -90]) {
      const a = getBoardFaces(flipped, r)
      const b = getBoardFaces([tile('a', 'PORT', 'AIR'), slots[1]], r)
      expect(a).toEqual(b)
    }
  })

  it('handles empty slots without fabricating faces', () => {
    const partial: Slots = [tile('a', 'AIR', 'PORT'), null]
    const faces = getBoardFaces(partial, 90)
    // At 90° a lone slot-0 tile spans the whole top screen row.
    expect(faces.topLeft).toBe('PORT')
    expect(faces.topRight).toBe('AIR')
    expect(faces.bottomLeft).toBeNull()
    expect(faces.bottomRight).toBeNull()
    const edges = getEdges(faces)
    expect(edges.top).toBe('PORTAIR')
    expect(edges.bottom).toBeNull()
    expect(edges.left).toBeNull()
    expect(edges.right).toBeNull()
  })
})

describe('isLevelSolved', () => {
  const solvedSlots: Slots = [tile('t1', 'AIR', 'PORT'), tile('t2', 'MAN', 'HOLE')]

  it('accepts the canonical solution', () => {
    expect(isLevelSolved(solvedSlots, 0, LEVEL)).toBe(true)
  })

  it('accepts the solution regardless of how many extra full turns the board took', () => {
    for (const r of [360, 720, -360, 3600, -7200]) {
      expect(isLevelSolved(solvedSlots, r, LEVEL)).toBe(true)
    }
  })

  it('rejects the solution at any other rotation', () => {
    for (const r of [90, 180, 270, 450, -90, -180]) {
      expect(isLevelSolved(solvedSlots, r, LEVEL)).toBe(false)
    }
  })

  it('accepts a flipped tile when the flip restores the solution reading', () => {
    // t1 stored PORT/AIR but flipped reads AIR/PORT.
    const viaFlip: Slots = [tile('t1', 'PORT', 'AIR', true), tile('t2', 'MAN', 'HOLE')]
    expect(isLevelSolved(viaFlip, 0, LEVEL)).toBe(true)
  })

  it('rejects a wrongly flipped tile', () => {
    const wrongFlip: Slots = [tile('t1', 'AIR', 'PORT', true), tile('t2', 'MAN', 'HOLE')]
    expect(isLevelSolved(wrongFlip, 0, LEVEL)).toBe(false)
  })

  it('rejects swapped slots', () => {
    const swapped: Slots = [tile('t2', 'MAN', 'HOLE'), tile('t1', 'AIR', 'PORT')]
    expect(isLevelSolved(swapped, 0, LEVEL)).toBe(false)
  })

  it('rejects incomplete boards', () => {
    expect(isLevelSolved([solvedSlots[0], null], 0, LEVEL)).toBe(false)
    expect(isLevelSolved([null, null], 0, LEVEL)).toBe(false)
  })

  it('solves rotation-required levels only once the board is turned', () => {
    const storage: Slots = [tile('t1', 'MAN', 'AIR'), tile('t2', 'HOLE', 'PORT')]
    expect(isLevelSolved(storage, 0, ROTATED_LEVEL)).toBe(false)
    expect(isLevelSolved(storage, 90, ROTATED_LEVEL)).toBe(true)
    expect(isLevelSolved(storage, 90 + 360 * 4, ROTATED_LEVEL)).toBe(true)
    expect(isLevelSolved(storage, 180, ROTATED_LEVEL)).toBe(false)
    expect(isLevelSolved(storage, 270, ROTATED_LEVEL)).toBe(false)
  })
})

describe('getExpectedEdges', () => {
  it('derives screen edges for non-rotated levels straight from storage', () => {
    expect(getExpectedEdges(LEVEL)).toEqual({
      top: 'AIRMAN',
      bottom: 'PORTHOLE',
      left: 'AIRPORT',
      right: 'MANHOLE',
    })
  })

  it('derives screen edges for rotated levels through the 90° transform', () => {
    expect(getExpectedEdges(ROTATED_LEVEL)).toEqual({
      top: 'AIRMAN',
      bottom: 'PORTHOLE',
      left: 'AIRPORT',
      right: 'MANHOLE',
    })
  })
})

describe('findSolutionTileForSlot', () => {
  it('finds the canonical tile without a flip', () => {
    expect(findSolutionTileForSlot(LEVEL, 0)).toEqual({
      tile: { id: 't1', top: 'AIR', bottom: 'PORT' },
      shouldFlip: false,
    })
  })

  it('flags a flip when the bank tile is stored upside down', () => {
    const level: Level = {
      ...LEVEL,
      tiles: [{ id: 't1', top: 'PORT', bottom: 'AIR' }, ...LEVEL.tiles.slice(1)],
    }
    expect(findSolutionTileForSlot(level, 0)).toEqual({
      tile: { id: 't1', top: 'PORT', bottom: 'AIR' },
      shouldFlip: true,
    })
  })
})

describe('sanitizeState', () => {
  const bank = (): Tile[] => LEVEL.tiles.map((t) => ({ ...t, isFlipped: false }))

  it('is a no-op on already-clean state', () => {
    const { slots, bank: outBank } = sanitizeState(LEVEL, [null, null], bank())
    expect(slots).toEqual([null, null])
    expect(outBank.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4', 't5'])
  })

  it('never lets a tile exist in both a slot and the bank', () => {
    const t1 = tile('t1', 'AIR', 'PORT')
    const { slots, bank: outBank } = sanitizeState(LEVEL, [t1, null], bank())
    expect(slots[0]?.id).toBe('t1')
    expect(outBank.some((t) => t.id === 't1')).toBe(false)
    expect(outBank).toHaveLength(4)
  })

  it('drops duplicate and unknown tiles from slots', () => {
    const dup = tile('t1', 'AIR', 'PORT')
    const ghost = tile('zz', 'FOO', 'BAR')
    const { slots } = sanitizeState(LEVEL, [dup, { ...dup }], [ghost, ...bank()])
    expect(slots[0]?.id).toBe('t1')
    expect(slots[1]).toBeNull()
  })

  it('restores missing tiles so the level always has all 5', () => {
    const { slots, bank: outBank } = sanitizeState(LEVEL, [null, null], [])
    const ids = [...outBank.map((t) => t.id)]
    expect(slots).toEqual([null, null])
    expect(ids.sort()).toEqual(['t1', 't2', 't3', 't4', 't5'])
  })

  it('preserves flip orientation across sanitization', () => {
    const flipped = tile('t3', 'OUT', 'MAN', true)
    const { bank: outBank } = sanitizeState(LEVEL, [null, null], [flipped, ...bank()])
    expect(outBank.find((t) => t.id === 't3')?.isFlipped).toBe(true)
  })

  it('is idempotent', () => {
    const first = sanitizeState(LEVEL, [tile('t2', 'MAN', 'HOLE', true), null], bank())
    const second = sanitizeState(LEVEL, first.slots, first.bank)
    expect(second).toEqual(first)
  })
})
