import { allLevels, pickSessionLevelsSeeded } from '@/game/levels'
import { LAUNCH_DATE } from './date'
import type { Level } from '@/game/types'
import type { EasternDate } from './types'

/**
 * Pool releases. The daily picker is deterministic ONLY for a fixed pool —
 * if the level library grows and past dates re-pick against the bigger pool,
 * every already-played day's session (and its archive replay) silently
 * changes. So each batch of levels gets a release date, and a given day's
 * session draws exclusively from the batches live on that day.
 *
 * RULES FOR ADDING LEVELS:
 *   1. Append the new levels to matrices.json / levels_generated.json with
 *      ids ABOVE the previous maximum. Never renumber shipped levels.
 *   2. Add one entry here: { from: <tomorrow-or-later>, maxId: <new max> }.
 *      Entries must stay sorted by `from`, and `from` must never be a date
 *      that has already passed for live players.
 */
const POOL_RELEASES: Array<{ from: EasternDate; maxId: number }> = [
  { from: LAUNCH_DATE, maxId: 101 },
  { from: '2026-07-03', maxId: 151 },
]

/** The subset of the library eligible for the given date's daily session. */
export function poolForDate(date: EasternDate): Level[] {
  let maxId = POOL_RELEASES[0].maxId
  for (const release of POOL_RELEASES) {
    if (date >= release.from) maxId = release.maxId
  }
  return allLevels.filter((l) => l.id <= maxId)
}

/**
 * Today's (or any past day's) 5-puzzle session. Deterministic for the given
 * date string — same date returns the same sequence, identically ordered,
 * forever, even as the level library grows (see POOL_RELEASES).
 */
export function getSessionForDate(date: EasternDate): Level[] {
  return pickSessionLevelsSeeded(`flipwords:${date}`, 5, poolForDate(date))
}
