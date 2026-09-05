import { pickSessionLevelsSeeded } from '@/game/levels'
import type { EditionConfig } from '@/edition/types'
import type { Level } from '@/game/types'
import { dayNumber, shiftDate } from './date'
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
 * Per-edition memo of every day's dealt ids. Sessions are pure functions of
 * (edition config, date), so caching is safe; it exists because the
 * no-repeat picker needs the full history before a date, and walking it
 * fresh for every render would be quadratic in days-since-launch.
 */
const sessionIdCache = new WeakMap<EditionConfig, Map<EasternDate, number[]>>()

function cachedSessionIds(edition: EditionConfig, date: EasternDate): number[] {
  let byDate = sessionIdCache.get(edition)
  if (!byDate) {
    byDate = new Map()
    sessionIdCache.set(edition, byDate)
  }
  const hit = byDate.get(date)
  if (hit) return hit
  const ids = dealSession(edition, date).map((l) => l.id)
  byDate.set(date, ids)
  return ids
}

/**
 * Day index (launch day = 0) each level was most recently served, over every
 * day from launch up to but NOT including `date`. Levels never served are
 * absent. Only ever consulted for dates on/after `noRepeatFrom`, but the walk
 * starts at launch so the pre-cutoff random era counts as history too — a
 * puzzle dealt the day before the cutoff should not be dealt again the day
 * after it.
 */
function lastServedBefore(
  edition: EditionConfig,
  date: EasternDate
): Map<number, number> {
  const lastServed = new Map<number, number>()
  const days = dayNumber(date, edition.launchDate) - 1
  let d = edition.launchDate
  for (let i = 0; i < days; i++) {
    for (const id of cachedSessionIds(edition, d)) lastServed.set(id, i)
    d = shiftDate(d, 1)
  }
  return lastServed
}

function dealSession(edition: EditionConfig, date: EasternDate): Level[] {
  const pool = poolForDate(edition, date)
  const seed = `${edition.seedPrefix}:${date}`
  const noRepeat =
    edition.noRepeatFrom !== undefined && date >= edition.noRepeatFrom
  return pickSessionLevelsSeeded(
    seed,
    5,
    pool,
    noRepeat ? lastServedBefore(edition, date) : undefined
  )
}

/**
 * Today's (or any past day's) 5-puzzle session. Deterministic for the given
 * edition + date — the same pair returns the same sequence, identically
 * ordered, forever, even as the level library grows (see poolReleases).
 *
 * Before `edition.noRepeatFrom` each slot is a uniform seeded draw from its
 * tier bucket, which repeats puzzles freely (a 151-level pool re-dealt the
 * same level three times in one week). From that date on, each slot draws
 * from the least-recently-served levels in its bucket, so every level gets a
 * turn before any comes back and newly released levels surface immediately.
 */
export function getSessionForDate(
  edition: EditionConfig,
  date: EasternDate
): Level[] {
  return dealSession(edition, date)
}
