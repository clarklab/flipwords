import type { EasternDate } from './types'

/**
 * The first day the daily feature is live. Day 1 of the puzzle numbering.
 * Set right before shipping. Until shipped, leave at the planned launch date.
 */
export const LAUNCH_DATE: EasternDate = '2026-05-19'

const FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Eastern-time calendar date (YYYY-MM-DD) at the given instant. */
export function easternDateString(now: Date = new Date()): EasternDate {
  return FORMATTER.format(now) as EasternDate
}
