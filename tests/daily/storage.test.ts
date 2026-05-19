import { describe, it, expect, beforeEach } from 'vitest'
import { loadStorage, saveStorage, freshStorage, STORAGE_KEY } from '@/daily/storage'

describe('storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('freshStorage returns a valid empty shape', () => {
    const s = freshStorage()
    expect(s.schemaVersion).toBe(1)
    expect(s.streak).toEqual({ current: 0, best: 0, lastCompletedDate: null })
    expect(s.sessions).toEqual({})
    expect(s.totals).toEqual({ sessionsPlayed: 0, perfectSessions: 0 })
  })

  it('loadStorage returns fresh state when no key set', () => {
    const s = loadStorage()
    expect(s).toEqual(freshStorage())
  })

  it('saveStorage + loadStorage round-trip', () => {
    const s = freshStorage()
    s.streak.current = 3
    s.streak.best = 5
    s.streak.lastCompletedDate = '2026-05-19'
    saveStorage(s)
    expect(loadStorage()).toEqual(s)
  })

  it('loadStorage returns fresh state on corrupt JSON', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json{')
    expect(loadStorage()).toEqual(freshStorage())
  })

  it('loadStorage returns fresh state on wrong schemaVersion', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }))
    expect(loadStorage()).toEqual(freshStorage())
  })
})
