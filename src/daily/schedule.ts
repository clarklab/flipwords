import { pickSessionLevelsSeeded } from '@/game/levels'
import type { EditionConfig } from '@/edition/types'
import type { Level } from '@/game/types'
import type { EasternDate } from './types'

/**
 * Pool releases. The daily picker is deterministic ONLY for a fixed pool —
 * if the level library grows and past dates re-pick against the bigger pool,
 * every already-played day's session (and its archive replay) silently
 * changes. So each batch of levels gets a release date, and a given day's
 * session draws exclusively from the batches live on that day.
 *
 * The schedule now lives on the edition config (`EditionConfig.poolReleases`)
 * so each edition grows independently.
 *
 * RULES FOR ADDING LEVELS:
 *   1. Append new levels with ids ABOVE the edition's previous maximum.
 *      Never renumber shipped levels.
 *   2. Add one entry to that edition's `poolReleases`:
 *      { from: <tomorrow-or-later>, maxId: <new max> }. Entries stay sorted
 *      by `from`, and `from` must never be a date that has already passed
 *      for live players.
 */

/** The subset of the edition's library eligible for the given date. */
export function poolForDate(
  edition: EditionConfig,
  date: EasternDate
): Level[] {
  const releases = edition.poolReleases
  let maxId = releases[0].maxId
  for (const release of releases) {
    if (date >= release.from) maxId = release.maxId
  }
  return edition.levels.filter((l) => l.id <= maxId)
}

/**
 * Today's (or any past day's) 5-puzzle session. Deterministic for the given
 * edition + date — the same pair returns the same sequence, identically
 * ordered, forever, even as the level library grows (see poolReleases).
 */
export function getSessionForDate(
  edition: EditionConfig,
  date: EasternDate
): Level[] {
  return pickSessionLevelsSeeded(
    `${edition.seedPrefix}:${date}`,
    5,
    poolForDate(edition, date)
  )
}
