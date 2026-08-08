import { describe, it, expect } from 'vitest'
import { editionBootScript, GAME_SELECT_PATH } from '@/edition'

/**
 * The boot script is an inline string that runs in <head> before first paint,
 * so it can't share code with `resolveEdition()` — it can only mirror it.
 * These tests execute the actual generated string against a stubbed
 * environment, covering both of its jobs: painting `data-edition` early, and
 * bouncing a first visit to `/` over to the game chooser.
 */

type BootEnv = {
  path?: string
  search?: string
  hostname?: string
  stored?: string | null
  storageThrows?: boolean
}

function runBootScript({
  path = '/',
  search = '',
  hostname = 'example.com',
  stored = null,
  storageThrows = false,
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
  const storage = {
    getItem: () => {
      if (storageThrows) throw new Error('blocked')
      return stored
    },
  }
  // Parameters shadow the real globals the script closes over.
  new Function('location', 'localStorage', 'document', editionBootScript())(
    location,
    storage,
    doc
  )
  return { edition: attrs['data-edition'], redirectedTo }
}

describe('editionBootScript', () => {
  it('sends a first visit to / to the game chooser, pre-paint', () => {
    const r = runBootScript()
    expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
    // The palette is still painted, in case the redirect is slow or blocked.
    expect(r.edition).toBe('texas')
  })

  it('does not redirect once an edition is remembered', () => {
    const r = runBootScript({ stored: 'flipwords' })
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
    const r = runBootScript({ storageThrows: true })
    expect(r.edition).toBe('texas')
    expect(r.redirectedTo).toBe(GAME_SELECT_PATH)
  })

  it('a stored choice beats the host pin', () => {
    const r = runBootScript({
      hostname: 'flipwords.superfun.games',
      stored: 'texas',
    })
    expect(r.redirectedTo).toBeNull()
    expect(r.edition).toBe('texas')
  })
})
