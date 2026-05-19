import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { easternDateString, dayNumber, LAUNCH_DATE, shiftDate } from '@/daily/date'
import { loadStorage } from '@/daily/storage'
import type { DailyStorage, StoredSession } from '@/daily/types'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

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
  const today = easternDateString()
  const launch = parseYM(LAUNCH_DATE)
  const todayYM = parseYM(today)

  // Default: show today's month
  const [{ y, m }, setMonth] = useState(todayYM)

  const [storage, setStorage] = useState<DailyStorage | null>(null)
  useEffect(() => {
    setStorage(loadStorage())
  }, [])

  const playedCount = storage ? Object.keys(storage.sessions).length : 0
  const totalDaysSinceLaunch = Math.max(0, dayNumber(today))
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
    <div className="h-[100dvh] w-full flex flex-col bg-chin overflow-hidden">
      <div className="flex-1 min-h-0 mt-1.5 md:mt-2 flex flex-col bg-paper rounded-[28px] md:rounded-[36px] shadow-play-lift relative z-10 overflow-y-auto px-4 py-4 md:px-6 md:py-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <Link
            to="/"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-tile-edge text-ink-muted hover:text-ink shadow-tile"
            aria-label="Back"
          >
            <span className="material-icons text-[20px]">chevron_left</span>
          </Link>
          <h1 className="font-wide text-xl text-ink tracking-[-0.01em]">Archive</h1>
          <div className="w-10 h-10" />
        </div>

        {/* Summary card */}
        <div className="grid grid-cols-3 border border-tile-edge rounded-[14px] bg-tile-face shadow-tile overflow-hidden mb-4">
          <SummaryCell value={playedCount.toString()} label="Played" />
          <SummaryCell value={perfects.toString()} label="Perfect" />
          <SummaryCell value={avgStars} label="Avg ★" />
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between pb-2.5">
          <button
            onClick={goPrev}
            disabled={!canGoBack}
            className={`p-1 ${canGoBack ? 'text-ink-muted hover:text-ink' : 'text-ink-soft/30'}`}
          >
            <span className="material-icons">chevron_left</span>
          </button>
          <p className="font-expand text-[17px] text-ink">
            {MONTH_NAMES[m]} {y}
          </p>
          <button
            onClick={goNext}
            disabled={!canGoForward}
            className={`p-1 ${canGoForward ? 'text-ink-muted hover:text-ink' : 'text-ink-soft/30'}`}
          >
            <span className="material-icons">chevron_right</span>
          </button>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEKDAY_LABELS.map((w, i) => (
            <span
              key={i}
              className="text-center font-ui text-[10px] text-ink-soft uppercase tracking-[0.18em]"
            >
              {w}
            </span>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((cell, i) => {
            if (cell.kind === 'empty') {
              return <div key={i} className="aspect-square" />
            }
            return (
              <DayCell
                key={i}
                day={cell.day}
                date={cell.date}
                today={today}
                launch={LAUNCH_DATE}
                stored={storage?.sessions[cell.date]}
                onClick={() => (navigate as any)({ to: '/archive/$date', params: { date: cell.date } })}
              />
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-3.5 pt-3.5 pb-2 text-[11px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-[3px] border"
              style={{
                background:
                  'linear-gradient(180deg, oklch(96% 0.06 180), oklch(92% 0.05 180))',
                borderColor: 'var(--color-accent)',
              }}
            />
            3-star
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-[3px] bg-tile-face border border-tile-edge" />
            Played
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-[3px]"
              style={{
                background: 'oklch(94% 0.012 85 / 0.45)',
                border: '1px dashed var(--color-paper-line)',
              }}
            />
            Missed
          </span>
        </div>
      </div>

      {/* Chin */}
      <div
        className="flex-shrink-0 bg-chin text-surface relative"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="relative z-20 w-full max-w-3xl mx-auto px-5 md:px-7 pt-3 md:pt-4 pb-1 flex items-center justify-between gap-4">
          <span className="font-ui text-[12px] uppercase tracking-[0.18em] text-surface/85">
            {playedCount} of {totalDaysSinceLaunch} sessions
          </span>
          <span className="font-ui text-[12px] uppercase tracking-[0.18em] text-surface/85">
            Tap a day
          </span>
        </div>
      </div>
    </div>
  )
}

function SummaryCell({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center py-3 border-l border-tile-edge first:border-l-0">
      <p className="font-expand text-[22px] text-ink leading-none">{value}</p>
      <p className="font-ui text-[10px] text-ink-soft uppercase tracking-[0.18em] mt-1.5">
        {label}
      </p>
    </div>
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

  let cls = 'aspect-square rounded-[5px] flex flex-col items-center justify-center text-[12px] font-ui '
  if (isFuture) {
    cls += 'text-ink-soft/40 cursor-default'
  } else if (isPreLaunch) {
    cls += 'opacity-30 cursor-default'
  } else if (isThreeStar) {
    cls +=
      'text-ink border border-accent cursor-pointer ' +
      '[background:linear-gradient(180deg,oklch(96%_0.06_180),oklch(92%_0.05_180))]'
  } else if (isPlayed) {
    cls += 'text-ink bg-tile-face border border-tile-edge cursor-pointer shadow-tile/40'
  } else if (isMissed) {
    cls +=
      'text-ink-soft cursor-default border border-dashed border-paper-line ' +
      '[background:oklch(94%_0.012_85_/_0.45)]'
  }
  if (isToday) cls += ' ring-2 ring-accent'

  const tappable = !isFuture && !isPreLaunch && !isMissed
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
            <span
              key={n}
              className="material-icons"
              style={{
                fontSize: 9,
                color:
                  n <= stored.stars ? 'var(--color-accent)' : 'var(--color-tile-edge)',
                fontVariationSettings:
                  n <= stored.stars
                    ? '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 20'
                    : '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 20',
              }}
            >
              star
            </span>
          ))}
        </span>
      )}
    </button>
  )
}

// Re-export for test simplicity
export { dayNumber, shiftDate }
