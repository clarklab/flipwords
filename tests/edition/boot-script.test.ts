import { describe, it, expect } from 'vitest'
import {
  EDITIONS,
  EDITION_STORAGE_KEY,
  GAME_SELECT_PATH,
  editionBootScript,
} from '@/edition'

/**
 * The boot script is an inline string that runs in <head> before first paint,
 * so it can't share code with `resolveEdition()` — it can only mirror it.
 * These tests execute the actual generated string against a stubbed
 * environment, covering all three of its jobs: painting `data-edition` early,
 * inferring a returning player's edition from their play history, and landing
 * every full load of `/` on the game chooser — the default front door —
 * unless an explicit `?edition=` deep link pins straight through.
 */

type BootEnv = {
  path?: string
  search?: string
  hostname?: string
  /** localStorage contents, key → raw value. */
  storage?: Record<string, string>
  getThrows?: boolean
  setThrows?: boolean
}

/** A storage blob with completed sessions — evidence of real play. */
const playedBlob = JSON.stringify({
  schemaVersion: 2,
  sessions: { '2026-08-07': { stars: 3 } },
})

/** What a settle-streak save leaves behind after merely visiting a title
 * screen: a fresh blob, no sessions. NOT evidence of play. */
const emptyBlob = JSON.stringify({ schemaVersion: 2, sessions: {} })

function runBootScript({
  path = '/',
  search = '',
  hostname = 'example.com',
  storage = {},
  getThrows = false,
  setThrows = false,
}: BootEnv = {}) {
  const attrs: Record<string, string> = {}
  const doc = {
    documentElement: {
      setAttribute: (k: string, v: string) => {
        attrs[k] = v
      },
    },
  }
  let redirectedTo: string | null = null
  const location = {
    pathname: path,
    search,
    hostname,
    replace: (url: string) => {
      redirectedTo = url
    },
  }
  const writes: Record<string, string> = {}
  const localStorage = {
    getItem: (k: string) => {
      if (getThrows) throw new Error('blocked')
      return storage[k] ?? null
    },
    setItem: (k: string, v: string) => {
      if (setThrows) throw new Error('blocked')
      writes[k] = v
    },
  }
  // Parameters shadow the real globals the script closes over.
  new Function('location', 'localStorage', 'document', editionBootScript())(
    location,
    localStorage,
    doc
  )
  return { edition: attrs['data-edition'], redirectedTo, writes }
}

describe('editionBootScript', () => {
  describe('the chooser is the default front door', () => {
    it('a first visit to / lands on the chooser, pre-paint', () => {
      const r = runBootScript()
      expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
      // The palette is still painted, in case the redirect is slow or blocked.
      expect(r.edition).toBe('texas')
    })

    it('a remembered choice still lands on the chooser — themed for it', () => {
      const r = runBootScript({
        storage: { [EDITION_STORAGE_KEY]: 'flipwords' },
      })
      expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
      expect(r.edition).toBe('flipwords')
    })

    it('host-pinned origins land on the chooser too, themed for the host', () => {
      const r = runBootScript({ hostname: 'flipwords.superfun.games' })
      expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
      expect(r.edition).toBe('flipwords')
    })

    it('survives blocked storage: paints the default and shows the chooser', () => {
      const r = runBootScript({ getThrows: true })
      expect(r.edition).toBe('texas')
      expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
    })

    it('never redirects away from routes other than /', () => {
      for (const path of [GAME_SELECT_PATH, '/play', '/archive']) {
        expect(runBootScript({ path }).redirectedTo).toBeNull()
      }
    })
  })

  describe('?edition= deep links pin straight through', () => {
    it('a valid ?edition= skips the chooser and lands directly', () => {
      const r = runBootScript({ search: '?edition=flipwords' })
      expect(r.redirectedTo).toBeNull()
      expect(r.edition).toBe('flipwords')
    })

    it('an invalid ?edition= is ignored — chooser as usual', () => {
      const r = runBootScript({ search: '?edition=klingon' })
      expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
      expect(r.edition).toBe('texas')
    })

    it('the param outranks a stored choice for theming', () => {
      const r = runBootScript({
        search: '?edition=texas',
        storage: { [EDITION_STORAGE_KEY]: 'flipwords' },
      })
      expect(r.redirectedTo).toBeNull()
      expect(r.edition).toBe('texas')
    })
  })

  describe('returning players are recognised from their play history', () => {
    it('the only edition ever played themes the chooser and is persisted', () => {
      const r = runBootScript({
        storage: { [EDITIONS.flipwords.storageKey]: playedBlob },
      })
      expect(r.edition).toBe('flipwords')
      // Persisted so resolution stays stable everywhere (play route, badge).
      expect(r.writes[EDITION_STORAGE_KEY]).toBe('flipwords')
    })

    it('works symmetrically for a texas-only history', () => {
      const r = runBootScript({
        storage: { [EDITIONS.texas.storageKey]: playedBlob },
      })
      expect(r.edition).toBe('texas')
      expect(r.writes[EDITION_STORAGE_KEY]).toBe('texas')
    })

    it('play history beats the host pin', () => {
      const r = runBootScript({
        hostname: 'flipwords.superfun.games',
        storage: { [EDITIONS.texas.storageKey]: playedBlob },
      })
      expect(r.edition).toBe('texas')
    })

    it('still resolves the played edition when the choice cannot persist', () => {
      const r = runBootScript({
        storage: { [EDITIONS.flipwords.storageKey]: playedBlob },
        setThrows: true,
      })
      expect(r.edition).toBe('flipwords')
    })

    it('a history in BOTH editions is ambiguous — nothing inferred', () => {
      const r = runBootScript({
        storage: {
          [EDITIONS.flipwords.storageKey]: playedBlob,
          [EDITIONS.texas.storageKey]: playedBlob,
        },
      })
      expect(r.edition).toBe('texas') // default fallback
      expect(r.writes[EDITION_STORAGE_KEY]).toBeUndefined()
    })

    it('an empty settle-streak blob is not a play history', () => {
      const r = runBootScript({
        storage: { [EDITIONS.texas.storageKey]: emptyBlob },
      })
      expect(r.writes[EDITION_STORAGE_KEY]).toBeUndefined()
    })

    it('a glanced-at edition does not muddy a real history elsewhere', () => {
      // A long-time player's actual device state: months of FlipWords
      // sessions plus the empty texas blob left by once opening the other
      // title screen.
      const r = runBootScript({
        storage: {
          [EDITIONS.flipwords.storageKey]: playedBlob,
          [EDITIONS.texas.storageKey]: emptyBlob,
        },
      })
      expect(r.edition).toBe('flipwords')
      expect(r.writes[EDITION_STORAGE_KEY]).toBe('flipwords')
    })

    it('corrupt daily blobs are ignored, not counted as play', () => {
      const r = runBootScript({
        storage: { [EDITIONS.flipwords.storageKey]: '{not json' },
      })
      expect(r.edition).toBe('texas') // default fallback
      expect(r.writes[EDITION_STORAGE_KEY]).toBeUndefined()
    })

    it('an explicit stored choice beats the play history', () => {
      const r = runBootScript({
        storage: {
          [EDITION_STORAGE_KEY]: 'texas',
          [EDITIONS.flipwords.storageKey]: playedBlob,
        },
      })
      expect(r.edition).toBe('texas')
    })
  })
})
