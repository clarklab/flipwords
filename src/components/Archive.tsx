import { useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Icon } from './Icon'
import { dayNumber, shiftDate } from '@/daily/date'
import { useEdition } from '@/edition'
import { useEasternDate } from '@/daily/useEasternDate'
import { useDailyStorage } from '@/daily/useDailyStorage'
import type { StoredSession } from '@/daily/types'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

/**
 * The Texas display face is a 65-glyph trial — space, comma, period, 0-9,
 * A-Z, a-z — so anything set in it must contain nothing else, or the missing
 * character falls back mid-string to a different family at a different
 * weight. Stat values are user data and can be the em-dash placeholder, so
 * they are gated: plain numerals get the display face, anything else keeps
 * the UI face. Month names ("August 2026") and "Archive" are safe by
 * inspection and are not gated.
 */
const DISPLAY_SAFE = /^[0-9. ]+$/

function ymdFromYM(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseYM(date: string): { y: number; m: number } {
  const [y, m] = date.split('-').map(Number)
  return { y, m: m - 1 }
}

function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate()
}

function dayOfWeek(year: number, month0: number, day: number): number {
  return new Date(Date.UTC(year, month0, day)).getUTCDay()
}

export default function Archive() {
  const navigate = useNavigate()
  // Live date + cross-tab-synced storage: the calendar's today ring, future
  // gating, and played counts stay correct without a reload.
  const { config } = useEdition()
  const today = useEasternDate()
  const launch = parseYM(config.launchDate)
  const todayYM = parseYM(today)

  // Default: show today's month
  const [{ y, m }, setMonth] = useState(todayYM)

  const { storage } = useDailyStorage(config)

  const playedCount = storage ? Object.keys(storage.sessions).length : 0
  const totalDaysSinceLaunch = Math.max(0, dayNumber(today, config.launchDate))
  const perfects = storage?.totals.perfectSessions ?? 0
  const avgStars = (() => {
    if (!storage || playedCount === 0) return '—'
    const total = Object.values(storage.sessions).reduce((s, r) => s + r.stars, 0)
    return (total / playedCount).toFixed(1)
  })()

  const cells = useMemo(() => {
    const total = daysInMonth(y, m)
    const padFront = dayOfWeek(y, m, 1)
    const out: Array<{ kind: 'empty' } | { kind: 'day'; day: number; date: string }> = []
    for (let i = 0; i < padFront; i++) out.push({ kind: 'empty' })
    for (let d = 1; d <= total; d++) out.push({ kind: 'day', day: d, date: ymdFromYM(y, m, d) })
    return out
  }, [y, m])

  const canGoBack = !(y === launch.y && m === launch.m)
  const canGoForward = !(y === todayYM.y && m === todayYM.m)

  const goPrev = () => {
    if (!canGoBack) return
    setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))
  }
  const goNext = () => {
    if (!canGoForward) return
    setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))
  }

  return (
    <div className="app-shell h-[100dvh] w-full flex flex-col bg-chin overflow-hidden">
      {/* .play-surface / .r-surface are the shared app-shell classes the title
          and play routes use, so all three full-screen surfaces take the same
          corner under FlipWords. Under Texas texas-page.css dissolves it. */}
      <div className="play-surface r-surface flex-1 min-h-0 mt-1.5 md:mt-2 flex flex-col bg-paper shadow-play-lift relative z-10 overflow-y-auto px-4 py-4 md:px-6 md:py-5">

        {/* Masthead — eyebrow over the title over a section rule, the way TM
            sets every page head. The eyebrow is the edition's own name, so it
            comes from the registry rather than a literal. */}
        <div className="arc-masthead tm-container relative rule-heavy pb-3 mb-3.5">
          <Link
            to="/"
            className="arc-back absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center bg-white border border-tile-edge fab-outline text-ink-muted hover:text-ink shadow-tile"
            aria-label="Back"
          >
            <Icon name="chevron" size={20} />
          </Link>
          <div className="arc-masthead-type text-center">
            <p className="tm-eyebrow tm-eyebrow-sm accent-type text-accent">
              {config.shortName}
            </p>
            <h1 className="arc-title tm-page-title tm-display font-wide text-xl text-ink tracking-[-0.01em] mt-1">
              Archive
            </h1>
          </div>
        </div>

        <div className="arc-body tm-container">
        {/* Summary band */}
        <div className="arc-summary grid grid-cols-3 border border-tile-edge r-panel bg-tile-face shadow-tile overflow-hidden mb-4">
          <SummaryCell value={playedCount.toString()} label="Played" />
          <SummaryCell value={perfects.toString()} label="Perfect" />
          <SummaryCell value={avgStars} label="Avg stars" />
        </div>

        {/* Month nav — the calendar's section head, ruled like one */}
        <div className="flex items-center justify-between rule-heavy pb-2 mb-2.5">
          <button
            onClick={goPrev}
            disabled={!canGoBack}
            className={`p-1 ${canGoBack ? 'text-ink-muted hover:text-ink' : 'arc-nav-off text-ink-soft/30'}`}
            aria-label="Previous month"
          >
            <Icon name="chevron" size={24} />
          </button>
          <p className="arc-month tm-display font-expand text-[17px] text-ink">
            {MONTH_NAMES[m]} {y}
          </p>
          <button
            onClick={goNext}
            disabled={!canGoForward}
            className={`p-1 ${canGoForward ? 'text-ink-muted hover:text-ink' : 'arc-nav-off text-ink-soft/30'}`}
            aria-label="Next month"
          >
            <Icon name="chevron" dir="right" size={24} />
          </button>
        </div>

        {/* Day-of-week header */}
        <div className="arc-grid grid grid-cols-7 gap-1.5 rule-hair pb-1.5 mb-1.5">
          {WEEKDAY_LABELS.map((w, i) => (
            <span key={i} className="tm-eyebrow tm-eyebrow-sm text-center text-ink-soft">
              {w}
            </span>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="arc-grid grid grid-cols-7 gap-1.5">
          {cells.map((cell, i) => {
            if (cell.kind === 'empty') {
              return (
                <div
                  key={i}
                  className="cal-cell cal-cell--blank aspect-square r-mark border border-transparent"
                />
              )
            }
            return (
              <DayCell
                key={i}
                day={cell.day}
                date={cell.date}
                today={today}
                launch={config.launchDate}
                stored={storage?.sessions[cell.date]}
                onClick={() => navigate({ to: '/archive/$date', params: { date: cell.date } })}
              />
            )
          })}
        </div>

        {/* Legend — the swatches carry the same state classes as the cells
            they describe, so the key can never drift from the grid. */}
        <div className="arc-legend flex items-center justify-center flex-wrap gap-x-3.5 gap-y-1.5 mt-2 pt-2.5 pb-2 text-ink-muted">
          <LegendKey state="cal-cell--perfect" label="3-star" />
          <LegendKey state="cal-cell--played" label="Played" />
          <LegendKey state="cal-cell--missed" dashed label="Missed" />
          <span className="tm-eyebrow tm-eyebrow-sm inline-flex items-center gap-1.5">
            <Icon name="clock" size={12} className="text-ink-soft" />
            Late
          </span>
        </div>
        </div>
      </div>

      {/* Chin — a ruled caps line closing the column under Texas. */}
      <div className="page-meta chin-safe flex-shrink-0 bg-chin text-surface relative">
        {/* .chin-row drives the chin foreground through --chin-ink: white on
            FlipWords' teal, near-black on the Texas orange, where white would
            not carry. Same treatment as the title and play chins. */}
        <div className="chin-row relative z-20 w-full max-w-3xl mx-auto px-5 md:px-7 pt-3 md:pt-4 pb-1 flex items-center justify-between gap-4">
          <span className="tm-eyebrow chin-dim">
            {playedCount} of {totalDaysSinceLaunch} days played
          </span>
          <span className="tm-eyebrow chin-dim">Choose a date</span>
        </div>
      </div>
    </div>
  )
}

function SummaryCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="arc-summary-cell text-center py-3 border-l border-tile-edge first:border-l-0">
      <p
        className={`arc-stat font-expand text-[22px] text-ink leading-none tabular-nums ${
          DISPLAY_SAFE.test(value) ? 'tm-display' : ''
        }`}
      >
        {value}
      </p>
      <p className="tm-eyebrow tm-eyebrow-sm text-ink-soft mt-1.5">{label}</p>
    </div>
  )
}

/** One swatch + label in the calendar key. */
function LegendKey({
  state,
  label,
  dashed = false,
}: {
  state: string
  label: string
  dashed?: boolean
}) {
  return (
    <span className="tm-eyebrow tm-eyebrow-sm inline-flex items-center gap-1.5">
      <span
        className={`inline-block w-3 h-3 r-mark border border-transparent ${
          dashed ? 'border-dashed ' : ''
        }${state}`}
      />
      {label}
    </span>
  )
}

function DayCell({
  day,
  date,
  today,
  launch,
  stored,
  onClick,
}: {
  day: number
  date: string
  today: string
  launch: string
  stored?: StoredSession
  onClick: () => void
}) {
  const isFuture = date > today
  const isPreLaunch = date < launch
  const isToday = date === today
  const isThreeStar = stored?.stars === 3
  const isPlayed = !!stored && !isThreeStar
  const isMissed = !stored && !isFuture && !isPreLaunch && !isToday

  // Every cell carries a border, transparent by default, so the Texas grid
  // can rule the whole table from CSS without changing any box size. Fill and
  // border colour live in texas-modals.css as .cal-cell--* so the legend can
  // reuse them and so both editions resolve from the same tokens — the four
  // oklch literals that used to live here did not survive the edition swap.
  let cls =
    'cal-cell aspect-square r-mark border border-transparent relative ' +
    'flex flex-col items-center justify-center text-[12px] font-ui tabular-nums '
  if (isFuture) {
    cls += 'cal-cell--future text-ink-soft/40 cursor-default'
  } else if (isPreLaunch) {
    cls += 'cal-cell--prelaunch opacity-30 cursor-default'
  } else if (isThreeStar) {
    cls += 'cal-cell--perfect text-ink cursor-pointer'
  } else if (isPlayed) {
    cls += 'cal-cell--played text-ink cursor-pointer'
  } else if (isMissed) {
    // Missed days are playable as makeups — tappable, with a hover invite.
    cls += 'cal-cell--missed border-dashed text-ink-soft hover:text-ink cursor-pointer transition-colors'
  } else {
    // Today, not yet played.
    cls += 'cal-cell--open cursor-pointer'
  }
  if (isToday) cls += ' ring-2 ring-accent'

  const tappable = !isFuture && !isPreLaunch
  return (
    <button
      type="button"
      onClick={tappable ? onClick : undefined}
      className={cls}
      disabled={!tappable}
    >
      <span className="leading-none">{day}</span>
      {stored && (
        <span className="inline-flex gap-px mt-1">
          {[1, 2, 3].map((n) => (
            <Icon
              key={n}
              name="star"
              size={9}
              filled={n <= stored.stars}
              style={{
                color:
                  n <= stored.stars ? 'var(--color-accent)' : 'var(--color-tile-edge)',
              }}
            />
          ))}
        </span>
      )}
      {stored?.mode === 'makeup' && (
        <span
          className="absolute top-0.5 right-0.5 text-ink-soft"
          aria-label="Played late"
        >
          <Icon name="clock" size={8} />
        </span>
      )}
    </button>
  )
}

// Re-export for test simplicity
export { dayNumber, shiftDate }
