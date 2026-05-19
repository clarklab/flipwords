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
  return FORMATTER.format(now)
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Parse a YYYY-MM-DD date string as a UTC date at midnight. */
function parseDate(date: EasternDate): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** Number of days since LAUNCH_DATE (inclusive). Launch day = 1. */
export function dayNumber(date: EasternDate): number {
  const diff = parseDate(date).getTime() - parseDate(LAUNCH_DATE).getTime()
  return Math.round(diff / MS_PER_DAY) + 1
}

/** Shift a date string forward/backward by `days` and return YYYY-MM-DD. */
export function shiftDate(date: EasternDate, days: number): EasternDate {
  const t = parseDate(date).getTime() + days * MS_PER_DAY
  const d = new Date(t)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
