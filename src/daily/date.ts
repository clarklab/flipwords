import type { EasternDate } from './types'

/**
 * The first day the daily feature is live. Day 1 of the puzzle numbering.
 * Set right before shipping. Until shipped, leave at the planned launch date.
 */
export const LAUNCH_DATE: EasternDate = '2026-05-18'

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

/**
 * Milliseconds until the next Eastern-midnight rollover. Uses Intl.DateTimeFormat
 * to read the current Eastern HMS, then subtracts from 24h. DST-safe because
 * Intl handles the offset internally.
 */
export function msUntilNextRollover(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const hour = get('hour') % 24 // 'en-US' may emit "24" at midnight; normalize
  const min = get('minute')
  const sec = get('second')
  const elapsed = ((hour * 60) + min) * 60 + sec
  const remaining = 24 * 60 * 60 - elapsed
  return remaining * 1000 - (now.getTime() % 1000)
}
