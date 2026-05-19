import { pickSessionLevelsSeeded } from '@/game/levels'
import type { Level } from '@/game/types'
import type { EasternDate } from './types'

/**
 * Today's (or any past day's) 5-puzzle session. Deterministic for the given
 * date string — same date returns the same sequence, identically ordered.
 */
export function getSessionForDate(date: EasternDate): Level[] {
  return pickSessionLevelsSeeded(`flipwords:${date}`, 5)
}
