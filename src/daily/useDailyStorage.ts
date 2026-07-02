import { useCallback, useEffect, useState } from 'react'
import { loadStorage, saveStorage, STORAGE_KEY } from './storage'
import type { DailyStorage } from './types'

/**
 * Daily storage as React state, kept in sync across tabs. `storage` is null
 * until the first client-side read (SSR-safe). `update` applies a pure
 * transform, persists it, and returns the new value.
 */
export function useDailyStorage(): {
  storage: DailyStorage | null
  update: (fn: (s: DailyStorage) => DailyStorage) => DailyStorage
  refresh: () => void
} {
  const [storage, setStorage] = useState<DailyStorage | null>(null)

  const refresh = useCallback(() => setStorage(loadStorage()), [])

  useEffect(() => {
    refresh()
    const onStorage = (e: StorageEvent) => {
      // key === null means "storage cleared"; refresh for that too.
      if (e.key === STORAGE_KEY || e.key === null) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const update = useCallback((fn: (s: DailyStorage) => DailyStorage) => {
    const next = fn(loadStorage())
    saveStorage(next)
    setStorage(next)
    return next
  }, [])

  return { storage, update, refresh }
}
