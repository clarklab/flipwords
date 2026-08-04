import type { EditionConfig } from '@/edition/types'
import type { DailyStorage, StoredSession } from './types'

/**
 * Storage is namespaced per edition — see `EditionConfig.storageKey`. The
 * config is threaded in explicitly rather than defaulted, because a default
 * would let a caller silently read or write another edition's streak.
 */

export function freshStorage(): DailyStorage {
  return {
    schemaVersion: 2,
    streak: { current: 0, best: 0, lastCompletedDate: null },
    sessions: {},
    totals: { sessionsPlayed: 0, perfectSessions: 0 },
    inProgress: null,
  }
}

type V1Session = Omit<StoredSession, 'mode'> & { isDailyResult?: true }
type V1Storage = {
  schemaVersion: 1
  streak?: DailyStorage['streak']
  sessions?: { [date: string]: V1Session }
  totals?: DailyStorage['totals']
}

function migrateV1(parsed: V1Storage): DailyStorage {
  const sessions: DailyStorage['sessions'] = {}
  for (const [date, s] of Object.entries(parsed.sessions ?? {})) {
    const { isDailyResult: _legacy, ...rest } = s
    sessions[date] = { ...rest, mode: 'daily' }
  }
  return {
    schemaVersion: 2,
    streak: parsed.streak ?? freshStorage().streak,
    sessions,
    totals: parsed.totals ?? freshStorage().totals,
    inProgress: null,
  }
}

/** Copy the raw blob aside before abandoning it — never silently destroy data. */
function backupAndStartFresh(edition: EditionConfig, raw: string): DailyStorage {
  try {
    window.localStorage.setItem(edition.backupKey, raw)
  } catch {
    // Quota/private-mode failures shouldn't block the game from loading.
  }
  return freshStorage()
}

export function loadStorage(edition: EditionConfig): DailyStorage {
  if (typeof window === 'undefined') return freshStorage()
  const raw = window.localStorage.getItem(edition.storageKey)
  if (!raw) return freshStorage()
  try {
    const parsed = JSON.parse(raw) as { schemaVersion?: unknown }
    if (parsed?.schemaVersion === 1) return migrateV1(parsed as V1Storage)
    if (parsed?.schemaVersion === 2) {
      const p = parsed as Partial<DailyStorage>
      return {
        schemaVersion: 2,
        streak: p.streak ?? freshStorage().streak,
        sessions: p.sessions ?? {},
        totals: p.totals ?? freshStorage().totals,
        inProgress: p.inProgress ?? null,
      }
    }
    return backupAndStartFresh(edition, raw)
  } catch {
    return backupAndStartFresh(edition, raw)
  }
}

export function saveStorage(edition: EditionConfig, s: DailyStorage): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(edition.storageKey, JSON.stringify(s))
}
