import { describe, it, expect } from 'vitest'
import { EDITIONS, EDITION_IDS } from '@/edition'

/**
 * Every compound in this game is split across two tiles, so each half is
 * rendered ALONE on screen — and flipping a tile puts the bottom half on top.
 * A word that is harmless inside a compound can therefore appear by itself as
 * a slur or an unfortunate standalone.
 *
 * This bit us for real: BACKHOE shipped a tile reading HOE, in a set that had
 * already (correctly) excluded HONKYTONK because it would have surfaced HONKY.
 * The rule was applied once and then forgotten, which is exactly what a test
 * is for.
 *
 * The list below is deliberately narrow — terms that are slurs or clearly
 * offensive standing alone. It is not a general profanity filter; it exists so
 * a new puzzle cannot silently reintroduce this class of defect.
 */
const FORBIDDEN_STANDALONE = new Set([
  'HONKY',
  'HOE',
  'COON',
  'SPIC',
  'WOP',
  'KIKE',
  'GYP',
  'JAP',
  'CHINK',
  'PAKI',
  'REDSKIN',
  'SQUAW',
  'INJUN',
  'WETBACK',
  'BEANER',
  'CRIPPLE',
  'RETARD',
  'TRANNY',
  'FAG',
  'DYKE',
  'SLUT',
  'WHORE',
  'RAPE',
  'NAZI',
])

describe('no tile half is offensive on its own', () => {
  for (const id of EDITION_IDS) {
    it(`${id}: every standalone tile half is safe`, () => {
      const offenders: string[] = []
      for (const level of EDITIONS[id].levels) {
        for (const tile of level.tiles) {
          for (const half of [tile.top, tile.bottom]) {
            if (FORBIDDEN_STANDALONE.has(half.toUpperCase())) {
              offenders.push(`level ${level.id} tile ${tile.id}: ${half}`)
            }
          }
        }
      }
      expect(offenders, offenders.join('\n')).toEqual([])
    })
  }
})

/**
 * A decoy that pairs two halves into a loaded phrase is the same hazard one
 * level up: the player sees both words stacked on a single tile.
 */
const FORBIDDEN_PAIRS = [
  ['SUN', 'TOWN'], // sundown towns — documented Texas segregation history
  ['MASTER', 'RACE'],
  ['WHITE', 'POWER'],
  ['LYNCH', 'MOB'],
]

describe('no tile pairs two halves into a loaded phrase', () => {
  for (const id of EDITION_IDS) {
    it(`${id}: no loaded tile pairings`, () => {
      const offenders: string[] = []
      for (const level of EDITIONS[id].levels) {
        for (const tile of level.tiles) {
          const a = tile.top.toUpperCase()
          const b = tile.bottom.toUpperCase()
          for (const [x, y] of FORBIDDEN_PAIRS) {
            if ((a === x && b === y) || (a === y && b === x)) {
              offenders.push(`level ${level.id} tile ${tile.id}: ${a}/${b}`)
            }
          }
        }
      }
      expect(offenders, offenders.join('\n')).toEqual([])
    })
  }
})
