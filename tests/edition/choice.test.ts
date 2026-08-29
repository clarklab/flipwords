import { describe, it, expect, beforeEach } from 'vitest'
import {
  EDITIONS,
  EDITION_STORAGE_KEY,
  editionsWithPlay,
  hasChosenEdition,
  resolveEdition,
} from '@/edition'

/**
 * The React-side mirror of the boot script's precedence (see
 * boot-script.test.ts for the inline-script half). Runs against jsdom's real
 * localStorage so the JSON round-trips are honest.
 */

const playedBlob = JSON.stringify({
  schemaVersion: 2,
  sessions: { '2026-08-07': { stars: 3 } },
})
const emptyBlob = JSON.stringify({ schemaVersion: 2, sessions: {} })

beforeEach(() => {
  window.localStorage.clear()
})

describe('editionsWithPlay', () => {
  it('is empty on a fresh device', () => {
    expect(editionsWithPlay()).toEqual([])
  })

  it('reports only editions with completed sessions', () => {
    window.localStorage.setItem(EDITIONS.flipwords.storageKey, playedBlob)
    window.localStorage.setItem(EDITIONS.texas.storageKey, emptyBlob)
    expect(editionsWithPlay()).toEqual(['flipwords'])
  })

  it('ignores corrupt blobs', () => {
    window.localStorage.setItem(EDITIONS.flipwords.storageKey, '{not json')
    window.localStorage.setItem(
      EDITIONS.texas.storageKey,
      JSON.stringify({ sessions: 'oops' })
    )
    expect(editionsWithPlay()).toEqual([])
  })
})

describe('resolveEdition with a play history', () => {
  it('resolves to the only edition ever played', () => {
    window.localStorage.setItem(EDITIONS.flipwords.storageKey, playedBlob)
    expect(resolveEdition()).toBe('flipwords')
  })

  it('a stored explicit choice still wins', () => {
    window.localStorage.setItem(EDITIONS.flipwords.storageKey, playedBlob)
    window.localStorage.setItem(EDITION_STORAGE_KEY, 'texas')
    expect(resolveEdition()).toBe('texas')
  })

  it('a history in both editions falls through to the default', () => {
    window.localStorage.setItem(EDITIONS.flipwords.storageKey, playedBlob)
    window.localStorage.setItem(EDITIONS.texas.storageKey, playedBlob)
    expect(resolveEdition()).toBe('texas')
  })
})

describe('hasChosenEdition', () => {
  it('is false on a fresh device', () => {
    expect(hasChosenEdition()).toBe(false)
  })

  it('is true for a stored explicit choice', () => {
    window.localStorage.setItem(EDITION_STORAGE_KEY, 'flipwords')
    expect(hasChosenEdition()).toBe(true)
  })

  it('is true for an unambiguous play history — the pre-chooser player', () => {
    window.localStorage.setItem(EDITIONS.flipwords.storageKey, playedBlob)
    expect(hasChosenEdition()).toBe(true)
  })

  it('is false when both editions have been played and nothing is stored', () => {
    window.localStorage.setItem(EDITIONS.flipwords.storageKey, playedBlob)
    window.localStorage.setItem(EDITIONS.texas.storageKey, playedBlob)
    expect(hasChosenEdition()).toBe(false)
  })
})
