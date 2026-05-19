import type { DailyStorage } from './types'

export const STORAGE_KEY = 'flipwords_daily_v1'

export function freshStorage(): DailyStorage {
  return {
    schemaVersion: 1,
    streak: { current: 0, best: 0, lastCompletedDate: null },
    sessions: {},
    totals: { sessionsPlayed: 0, perfectSessions: 0 },
  }
}

export function loadStorage(): DailyStorage {
  if (typeof window === 'undefined') return freshStorage()
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return freshStorage()
  try {
    const parsed = JSON.parse(raw) as Partial<DailyStorage>
    if (parsed?.schemaVersion !== 1) return freshStorage()
    return {
      schemaVersion: 1,
      streak: parsed.streak ?? freshStorage().streak,
      sessions: parsed.sessions ?? {},
      totals: parsed.totals ?? freshStorage().totals,
    }
  } catch {
    return freshStorage()
  }
}

export function saveStorage(s: DailyStorage): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}
