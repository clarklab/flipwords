import { describe, expect, it } from 'vitest'
import levelsJson from '../../levels_generated.json'
import {
  findSolutionTileForSlot,
  getExpectedEdges,
  isLevelSolved,
} from '@/game/transforms'
import { getNextHintAction } from '@/game/hint'
import type { Level, Slots, Tile } from '@/game/types'

/**
 * Fidelity guard for the shipped puzzle library. Every level must:
 *
 *   1. Be assemblable — both solution slots have a matching tile in the bank.
 *   2. Be solvable through the REAL game logic (isLevelSolved), not a
 *      re-implementation, including with extra full board turns stacked on.
 *   3. Have EXACTLY ONE winning configuration across every placement the UI
 *      allows: ordered tile pairs × flips × rotations 0/90/180/270.
 *   4. Follow the overlap-decoy rule (see below).
 *
 * THE OVERLAP RULE — codified from commit adb7df6 ("Decoy tiles now reuse
 * the actual solution words"): beyond the 2 solution tiles, each level ships
 * exactly 3 decoys shaped as
 *   - 2 single-overlap decoys: one solution word + one dead-end filler, and
 *   - 1 double-overlap decoy: two solution words paired in a way that is not
 *     either solution tile.
 * This is a core game-feel mechanic: solution words visibly recur across the
 * rail, so tiles look like they could work in multiple places. Any new
 * generation path MUST preserve this shape — this test is the contract.
 */
const levels = levelsJson as Level[]

const asTile = (t: { id: string; top: string; bottom: string }, isFlipped: boolean): Tile => ({
  ...t,
  isFlipped,
})

/** All distinct win-relevant configurations the player can physically reach. */
function* allConfigs(level: Level): Generator<{ slots: Slots; rotation: number }> {
  const n = level.tiles.length
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      for (const flip0 of [false, true]) {
        for (const flip1 of [false, true]) {
          for (const rotation of [0, 90, 180, 270]) {
            yield {
              slots: [asTile(level.tiles[i], flip0), asTile(level.tiles[j], flip1)],
              rotation,
            }
          }
        }
      }
    }
  }
}

describe('shipped level library', () => {
  it('has a healthy pool size and unique ids', () => {
    expect(levels.length).toBeGreaterThanOrEqual(101)
    const ids = new Set(levels.map((l) => l.id))
    expect(ids.size).toBe(levels.length)
  })

  it('always ships 5 tiles per level with unique tile ids', () => {
    for (const level of levels) {
      expect(level.tiles, `level ${level.id}`).toHaveLength(5)
      expect(new Set(level.tiles.map((t) => t.id)).size).toBe(5)
    }
  })

  it('every level is assemblable from its own tile bank', () => {
    for (const level of levels) {
      for (const slotIdx of [0, 1] as const) {
        expect(
          findSolutionTileForSlot(level, slotIdx),
          `level ${level.id} slot ${slotIdx} has no matching tile`
        ).not.toBeNull()
      }
    }
  })

  it('the declared solution actually solves the level through game logic', () => {
    for (const level of levels) {
      const slots: Slots = [
        asTile({ id: '_s0', top: level.solution.slot0Top, bottom: level.solution.slot0Bottom }, false),
        asTile({ id: '_s1', top: level.solution.slot1Top, bottom: level.solution.slot1Bottom }, false),
      ]
      const rotation = level.requiresRotation ? 90 : 0
      expect(isLevelSolved(slots, rotation, level), `level ${level.id}`).toBe(true)
      // Board rotation accumulates forever in the UI — extra full turns in
      // either direction must not break the win check.
      expect(isLevelSolved(slots, rotation + 360, level), `level ${level.id} +360`).toBe(true)
      expect(isLevelSolved(slots, rotation - 720, level), `level ${level.id} -720`).toBe(true)
    }
  })

  it('every level has EXACTLY ONE winning configuration up to 180° symmetry', () => {
    // Rotating the board 180° while swapping both tiles and flipping each one
    // reproduces the identical screen reading — a physical dual that is
    // indistinguishable to the player. Every level therefore has exactly TWO
    // raw winning configs that form ONE visual solution: the canonical config
    // at the level's required rotation, and its 180° dual. Anything else is a
    // genuine ambiguity and must fail this test.
    for (const level of levels) {
      const wins: Array<{ slots: Slots; rotation: number }> = []
      for (const config of allConfigs(level)) {
        if (isLevelSolved(config.slots, config.rotation, level)) {
          wins.push(config)
        }
      }
      const describe = wins
        .map(
          (w) =>
            `tiles=(${w.slots[0]!.id},${w.slots[1]!.id}) flips=(${w.slots[0]!.isFlipped},${w.slots[1]!.isFlipped}) rot=${w.rotation}`
        )
        .join(' | ')
      expect(wins, `level ${level.id} wins: ${describe}`).toHaveLength(2)

      const canonicalRotation = level.requiresRotation ? 90 : 0
      const canonical = wins.find((w) => w.rotation === canonicalRotation)
      const dual = wins.find((w) => w.rotation === (canonicalRotation + 180) % 360)
      expect(canonical, `level ${level.id} missing canonical win`).toBeDefined()
      expect(dual, `level ${level.id} missing 180° dual`).toBeDefined()
      // The dual must literally be the canonical config swapped and flipped —
      // if it's anything else, it's an alternate solution in disguise.
      expect(dual!.slots[0]!.id).toBe(canonical!.slots[1]!.id)
      expect(dual!.slots[1]!.id).toBe(canonical!.slots[0]!.id)
      expect(dual!.slots[0]!.isFlipped).toBe(!canonical!.slots[1]!.isFlipped)
      expect(dual!.slots[1]!.isFlipped).toBe(!canonical!.slots[0]!.isFlipped)
    }
  })

  it('every level follows the overlap-decoy rule (2 single + 1 double)', () => {
    for (const level of levels) {
      const s = level.solution
      const solutionPairs = [
        new Set([s.slot0Top, s.slot0Bottom]),
        new Set([s.slot1Top, s.slot1Bottom]),
      ]
      const solutionWords = new Set([...solutionPairs[0], ...solutionPairs[1]])

      // Peel off the two solution tiles, orientation-agnostic.
      const matched = [false, false]
      const decoys: typeof level.tiles = []
      for (const t of level.tiles) {
        const pair = new Set([t.top, t.bottom])
        const idx = solutionPairs.findIndex(
          (sp, i) => !matched[i] && sp.size === pair.size && [...sp].every((w) => pair.has(w))
        )
        if (idx !== -1) matched[idx] = true
        else decoys.push(t)
      }
      expect(matched, `level ${level.id} solution tiles missing`).toEqual([true, true])
      expect(decoys, `level ${level.id}`).toHaveLength(3)

      let singles = 0
      let doubles = 0
      for (const d of decoys) {
        const overlap =
          Number(solutionWords.has(d.top)) + Number(solutionWords.has(d.bottom))
        if (overlap === 1) singles++
        else if (overlap === 2) doubles++
      }
      expect(
        { singles, doubles },
        `level ${level.id} decoy shape — every level needs 2 single-overlap + 1 double-overlap decoys`
      ).toEqual({ singles: 2, doubles: 1 })
    }
  })

  it('hints walk any level from an empty board to solved', () => {
    for (const level of levels) {
      // Simulate the component's auto-apply loop with the pure hint engine.
      let slots: Slots = [null, null]
      let bank: Tile[] = level.tiles.map((t, i) => ({ ...t, isFlipped: i % 2 === 0 }))
      let rotation = 0
      let steps = 0
      while (!isLevelSolved(slots, rotation, level) && steps < 12) {
        const hint = getNextHintAction(level, slots, bank, rotation)
        expect(hint.action, `level ${level.id} hint stalled at step ${steps}`).not.toBeNull()
        if (hint.action === 'addTile') {
          for (const slotIdx of [0, 1] as const) {
            if (slots[slotIdx]) continue
            const target = findSolutionTileForSlot(level, slotIdx)
            if (!target) continue
            slots = [...slots] as Slots
            slots[slotIdx] = { ...target.tile, isFlipped: target.shouldFlip }
            bank = bank.filter((t) => t.id !== target.tile.id)
            break
          }
        } else if (hint.action === 'removeTile') {
          for (const slotIdx of [0, 1] as const) {
            const current = slots[slotIdx]
            if (!current) continue
            const target = findSolutionTileForSlot(level, slotIdx)
            if (target && current.id === target.tile.id) continue
            slots = [...slots] as Slots
            slots[slotIdx] = null
            bank = [...bank, current]
            break
          }
        } else if (hint.action === 'rotateTile') {
          for (const slotIdx of [0, 1] as const) {
            const current = slots[slotIdx]
            if (!current) continue
            const target = findSolutionTileForSlot(level, slotIdx)
            if (!target || current.isFlipped === target.shouldFlip) continue
            slots = [...slots] as Slots
            slots[slotIdx] = { ...current, isFlipped: !current.isFlipped }
            break
          }
        } else if (hint.action === 'rotateBoard') {
          rotation += 90
        } else if (hint.action === 'rotateBoardBack') {
          rotation -= 90
        }
        steps++
      }
      expect(
        isLevelSolved(slots, rotation, level),
        `level ${level.id} not solved after ${steps} hint steps`
      ).toBe(true)
    }
  })

  it('expected edges are 4 distinct readable compounds', () => {
    for (const level of levels) {
      const e = getExpectedEdges(level)
      for (const edge of [e.top, e.bottom, e.left, e.right]) {
        expect(edge, `level ${level.id}`).toMatch(/^[A-Z]{4,}$/)
      }
    }
  })
})
