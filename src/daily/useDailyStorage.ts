import { useCallback, useEffect, useState } from 'react'
import { loadStorage, saveStorage } from './storage'
import type { EditionConfig } from '@/edition/types'
import type { DailyStorage } from './types'

/**
 * Daily storage as React state, kept in sync across tabs. `storage` is null
 * until the first client-side read (SSR-safe). `update` applies a pure
 * transform, persists it, and returns the new value.
 *
 * Re-reads when the edition changes, so flipping the toggle swaps to that
 * edition's streak and history rather than showing stale numbers.
 */
export function useDailyStorage(edition: EditionConfig): {
  storage: DailyStorage | null
  update: (fn: (s: DailyStorage) => DailyStorage) => DailyStorage
  refresh: () => void
} {
  const [storage, setStorage] = useState<DailyStorage | null>(null)

  const refresh = useCallback(
    () => setStorage(loadStorage(edition)),
    [edition]
  )

  useEffect(() => {
    refresh()
    const onStorage = (e: StorageEvent) => {
      // key === null means "storage cleared"; refresh for that too.
      if (e.key === edition.storageKey || e.key === null) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh, edition.storageKey])

  const update = useCallback(
    (fn: (s: DailyStorage) => DailyStorage) => {
      const next = fn(loadStorage(edition))
      saveStorage(edition, next)
      setStorage(next)
      return next
    },
    [edition]
  )

  return { storage, update, refresh }
}
