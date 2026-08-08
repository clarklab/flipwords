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
 * inferring a choice from an existing play history, and bouncing a genuine
 * first visit to `/` over to the game chooser.
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
  it('sends a genuine first visit to / to the game chooser, pre-paint', () => {
    const r = runBootScript()
    expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
    // The palette is still painted, in case the redirect is slow or blocked.
    expect(r.edition).toBe('texas')
  })

  it('does not redirect once an edition is remembered', () => {
    const r = runBootScript({
      storage: { [EDITION_STORAGE_KEY]: 'flipwords' },
    })
    expect(r.redirectedTo).toBeNull()
    expect(r.edition).toBe('flipwords')
  })

  it('treats an explicit ?edition= deep link as a choice', () => {
    const r = runBootScript({ search: '?edition=flipwords' })
    expect(r.redirectedTo).toBeNull()
    expect(r.edition).toBe('flipwords')
  })

  it('ignores an invalid ?edition= and still shows the fork', () => {
    const r = runBootScript({ search: '?edition=klingon' })
    expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
    expect(r.edition).toBe('texas')
  })

  it('never redirects away from routes other than /', () => {
    for (const path of [GAME_SELECT_PATH, '/play', '/archive']) {
      expect(runBootScript({ path }).redirectedTo).toBeNull()
    }
  })

  it('shows the fork on a host-pinned origin too, themed for that host', () => {
    const r = runBootScript({ hostname: 'flipwords.superfun.games' })
    // The pin answers "which brand does this origin fall back to", not
    // "which game did this person pick" — first visits still get the choice.
    expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
    expect(r.edition).toBe('flipwords')
  })

  it('survives blocked storage: paints the default and shows the fork', () => {
    const r = runBootScript({ getThrows: true })
    expect(r.edition).toBe('texas')
    expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
  })

  it('a stored choice beats the host pin', () => {
    const r = runBootScript({
      hostname: 'flipwords.superfun.games',
      storage: { [EDITION_STORAGE_KEY]: 'texas' },
    })
    expect(r.redirectedTo).toBeNull()
    expect(r.edition).toBe('texas')
  })

  describe('players who predate the chooser (play history, no choice key)', () => {
    it('boots straight into the only edition ever played — no fork', () => {
      const r = runBootScript({
        storage: { [EDITIONS.flipwords.storageKey]: playedBlob },
      })
      expect(r.redirectedTo).toBeNull()
      expect(r.edition).toBe('flipwords')
      // The inference is persisted so every later load takes the fast path.
      expect(r.writes[EDITION_STORAGE_KEY]).toBe('flipwords')
    })

    it('works symmetrically for a texas-only history', () => {
      const r = runBootScript({
        storage: { [EDITIONS.texas.storageKey]: playedBlob },
      })
      expect(r.redirectedTo).toBeNull()
      expect(r.edition).toBe('texas')
      expect(r.writes[EDITION_STORAGE_KEY]).toBe('texas')
    })

    it('play history beats the host pin', () => {
      const r = runBootScript({
        hostname: 'flipwords.superfun.games',
        storage: { [EDITIONS.texas.storageKey]: playedBlob },
      })
      expect(r.redirectedTo).toBeNull()
      expect(r.edition).toBe('texas')
    })

    it('still boots into the played edition when the choice cannot persist', () => {
      const r = runBootScript({
        storage: { [EDITIONS.flipwords.storageKey]: playedBlob },
        setThrows: true,
      })
      expect(r.redirectedTo).toBeNull()
      expect(r.edition).toBe('flipwords')
    })

    it('a history in BOTH editions is ambiguous — fork', () => {
      const r = runBootScript({
        storage: {
          [EDITIONS.flipwords.storageKey]: playedBlob,
          [EDITIONS.texas.storageKey]: playedBlob,
        },
      })
      expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
      expect(r.writes[EDITION_STORAGE_KEY]).toBeUndefined()
    })

    it('an empty settle-streak blob is not a play history — fork', () => {
      const r = runBootScript({
        storage: { [EDITIONS.texas.storageKey]: emptyBlob },
      })
      expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
    })

    it('a glanced-at edition does not muddy a real history elsewhere', () => {
      // The parents' actual device state: months of FlipWords sessions plus
      // the empty texas blob left by once opening the other title screen.
      const r = runBootScript({
        storage: {
          [EDITIONS.flipwords.storageKey]: playedBlob,
          [EDITIONS.texas.storageKey]: emptyBlob,
        },
      })
      expect(r.redirectedTo).toBeNull()
      expect(r.edition).toBe('flipwords')
      expect(r.writes[EDITION_STORAGE_KEY]).toBe('flipwords')
    })

    it('corrupt daily blobs are ignored, not counted as play', () => {
      const r = runBootScript({
        storage: { [EDITIONS.flipwords.storageKey]: '{not json' },
      })
      expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
    })

    it('an explicit stored choice beats the play history', () => {
      const r = runBootScript({
        storage: {
          [EDITION_STORAGE_KEY]: 'texas',
          [EDITIONS.flipwords.storageKey]: playedBlob,
        },
      })
      expect(r.redirectedTo).toBeNull()
      expect(r.edition).toBe('texas')
    })

    it('an ?edition= deep link beats the play history', () => {
      const r = runBootScript({
        search: '?edition=texas',
        storage: { [EDITIONS.flipwords.storageKey]: playedBlob },
      })
      expect(r.redirectedTo).toBeNull()
      expect(r.edition).toBe('texas')
    })
  })
})
