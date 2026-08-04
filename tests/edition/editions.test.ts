import { describe, it, expect } from 'vitest'
import { EDITIONS, EDITION_IDS } from '@/edition'
import { getSessionForDate, poolForDate } from '@/daily/schedule'
import { shiftDate } from '@/daily/date'
import { loadStorage, saveStorage, freshStorage } from '@/daily/storage'
import { getExpectedEdges, isLevelSolved } from '@/game/transforms'

/**
 * Guards the invariants documented in docs/edition-architecture.md. Each of
 * these, if violated, fails silently at runtime — bleeding one edition's
 * progress into the other, or retroactively re-dealing days people already
 * played — so they get asserted rather than trusted.
 */
describe('edition registry invariants', () => {
  it('every edition ships puzzles', () => {
    for (const id of EDITION_IDS) {
      expect(EDITIONS[id].levels.length, id).toBeGreaterThan(0)
    }
  })

  it('storage keys are unique across editions', () => {
    const keys = EDITION_IDS.flatMap((id) => [
      EDITIONS[id].storageKey,
      EDITIONS[id].backupKey,
    ])
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('seed prefixes are unique across editions', () => {
    const seeds = EDITION_IDS.map((id) => EDITIONS[id].seedPrefix)
    expect(new Set(seeds).size).toBe(seeds.length)
  })

  it('level ids are unique within each edition', () => {
    for (const id of EDITION_IDS) {
      const ids = EDITIONS[id].levels.map((l) => l.id)
      expect(new Set(ids).size, id).toBe(ids.length)
    }
  })

  it('pool releases are sorted by date and pinned to a real max id', () => {
    for (const id of EDITION_IDS) {
      const cfg = EDITIONS[id]
      const froms = cfg.poolReleases.map((r) => r.from)
      expect([...froms].sort(), id).toEqual(froms)

      // An open ceiling (e.g. MAX_SAFE_INTEGER) would let a newly added
      // puzzle rewrite the sessions of days already played.
      const highestRelease = Math.max(...cfg.poolReleases.map((r) => r.maxId))
      const highestLevel = Math.max(...cfg.levels.map((l) => l.id))
      expect(highestRelease, id).toBe(highestLevel)
    }
  })

  it('theme color is a concrete hex', () => {
    for (const id of EDITION_IDS) {
      expect(EDITIONS[id].themeColor, id).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('confetti palettes are concrete hex colors', () => {
    for (const id of EDITION_IDS) {
      expect(EDITIONS[id].confetti.length, id).toBeGreaterThan(0)
      for (const c of EDITIONS[id].confetti) {
        expect(c, id).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
  })
})

describe('every edition can actually be played', () => {
  for (const id of EDITION_IDS) {
    describe(id, () => {
      const cfg = EDITIONS[id]

      it('the launch date deals a full 5-puzzle session', () => {
        expect(poolForDate(cfg, cfg.launchDate).length).toBeGreaterThan(0)
        expect(getSessionForDate(cfg, cfg.launchDate)).toHaveLength(5)
      })

      it('sessions are deterministic for a date', () => {
        const a = getSessionForDate(cfg, cfg.launchDate).map((l) => l.id)
        const b = getSessionForDate(cfg, cfg.launchDate).map((l) => l.id)
        expect(a).toEqual(b)
      })

      it('a session never repeats a puzzle', () => {
        const ids = getSessionForDate(cfg, cfg.launchDate).map((l) => l.id)
        expect(new Set(ids).size).toBe(ids.length)
      })

      it('every shipped level is solvable exactly as declared', () => {
        for (const level of cfg.levels) {
          const slots: [any, any] = [
            {
              id: '_s0',
              top: level.solution.slot0Top,
              bottom: level.solution.slot0Bottom,
              isFlipped: false,
            },
            {
              id: '_s1',
              top: level.solution.slot1Top,
              bottom: level.solution.slot1Bottom,
              isFlipped: false,
            },
          ]
          const rotation = level.requiresRotation ? 90 : 0
          expect(
            isLevelSolved(slots, rotation, level),
            `${id} level ${level.id}`
          ).toBe(true)

          // And the solution must be assemblable from the tiles it ships with.
          for (const [top, bottom] of [
            [level.solution.slot0Top, level.solution.slot0Bottom],
            [level.solution.slot1Top, level.solution.slot1Bottom],
          ]) {
            const has = level.tiles.some(
              (t) =>
                (t.top === top && t.bottom === bottom) ||
                (t.top === bottom && t.bottom === top)
            )
            expect(has, `${id} level ${level.id} slot ${top}/${bottom}`).toBe(
              true
            )
          }
          expect(getExpectedEdges(level)).toBeTruthy()
        }
      })
    })
  }
})

describe('texas edition content', () => {
  it('ships at least three dozen puzzles', () => {
    expect(EDITIONS.texas.levels.length).toBeGreaterThanOrEqual(36)
  })

  it('every clue fits the on-screen pill (32 char cap)', () => {
    for (const level of EDITIONS.texas.levels) {
      for (const [side, clue] of Object.entries(level.hints)) {
        expect(clue.length, `level ${level.id} ${side}: ${clue}`).toBeLessThanOrEqual(32)
      }
    }
  })

  it('no clue leaks its own answer', () => {
    for (const level of EDITIONS.texas.levels) {
      const e = getExpectedEdges(level)
      const all = [e.top, e.bottom, e.left, e.right]
      for (const clue of Object.values(level.hints)) {
        for (const answer of all) {
          expect(
            clue.toLowerCase().includes(answer.toLowerCase()),
            `level ${level.id}: "${clue}" contains ${answer}`
          ).toBe(false)
        }
      }
    }
  })

  it('sessions actually end on a rotation puzzle', () => {
    // The 5th slot is meant to exercise every mechanic. The previous version
    // of this test only asserted that SOME rotated level existed, which is
    // true by construction and proves nothing about any session.
    const cfg = EDITIONS.texas
    let date = cfg.launchDate
    for (let i = 0; i < 60; i++) {
      const session = getSessionForDate(cfg, date)
      expect(session, date).toHaveLength(5)
      expect(session[4].requiresRotation, `${date} ends on ${session[4].id}`).toBe(true)
      date = shiftDate(date, 1)
    }
  })
})


/**
 * The bug this guards against actually shipped: the provider resolved the
 * edition in an effect, so one commit ran against the default edition — long
 * enough to seed React state from, and write a settled streak into, the OTHER
 * edition's localStorage key.
 */
describe('editions cannot read or write each other\'s storage', () => {
  it('a write to one edition is invisible to the other', () => {
    window.localStorage.clear()
    const a = EDITIONS.flipwords
    const b = EDITIONS.texas

    const marked = freshStorage()
    marked.streak = { current: 9, best: 12, lastCompletedDate: '2026-08-01' }
    saveStorage(a, marked)

    expect(loadStorage(a).streak.current).toBe(9)
    expect(loadStorage(b).streak.current).toBe(0)
    expect(loadStorage(b)).toEqual(freshStorage())
  })

  it('the two editions never share a storage key', () => {
    const keys = EDITION_IDS.map((id) => EDITIONS[id].storageKey)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('editions deal different puzzles', () => {
  it('the same date yields different sessions per edition', () => {
    const date = '2026-08-03'
    const fw = getSessionForDate(EDITIONS.flipwords, date).map((l) => l.id)
    const tx = getSessionForDate(EDITIONS.texas, date).map((l) => l.id)
    // Different libraries entirely — the titles must not overlap.
    const fwTitles = new Set(
      getSessionForDate(EDITIONS.flipwords, date).map((l) => l.title)
    )
    const txTitles = getSessionForDate(EDITIONS.texas, date).map((l) => l.title)
    expect(txTitles.some((t) => fwTitles.has(t))).toBe(false)
    expect(fw.join()).not.toBe(tx.join())
  })

  it('poolForDate excludes ids above the release ceiling', () => {
    const cfg = EDITIONS.texas
    const ceiling = Math.max(...cfg.poolReleases.map((r) => r.maxId))
    for (const lvl of poolForDate(cfg, cfg.launchDate)) {
      expect(lvl.id).toBeLessThanOrEqual(ceiling)
    }
  })
})
