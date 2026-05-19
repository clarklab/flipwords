import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import AnimatedWordmark from './AnimatedWordmark'
import { easternDateString, dayNumber, msUntilNextRollover } from '@/daily/date'
import { loadStorage, saveStorage } from '@/daily/storage'
import { settleStreak } from '@/daily/streak'
import type { DailyStorage } from '@/daily/types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function formatPuzzleNumber(n: number): string {
  return n < 1000 ? n.toString().padStart(3, '0') : n.toString()
}

function easternHeaderDate(today: string): string {
  // Parse YYYY-MM-DD as UTC midnight (timezone-agnostic, only used for the
  // weekday/month labels — no DST math involved).
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return `${WEEKDAYS[date.getUTCDay()]} · ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`
}

export default function TitleScreen() {
  const today = easternDateString()
  const dn = dayNumber(today)

  // Settle streak on mount so a missed-day reset shows immediately.
  const [storage, setStorage] = useState<DailyStorage | null>(null)
  useEffect(() => {
    const settled = settleStreak(loadStorage(), today)
    saveStorage(settled)
    setStorage(settled)
  }, [today])

  // Countdown ticker (60s cadence — good enough for `9h 37m`).
  const [countdown, setCountdown] = useState(msUntilNextRollover())
  useEffect(() => {
    const tick = () => setCountdown(msUntilNextRollover())
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const todaysSessionDone = !!storage?.sessions[today]
  const streak = storage?.streak.current ?? 0
  const sessionsPlayed = storage?.totals.sessionsPlayed ?? 0
  const perfectSessions = storage?.totals.perfectSessions ?? 0
  const avgStars = (() => {
    if (!storage || sessionsPlayed === 0) return null
    const total = Object.values(storage.sessions).reduce((s, r) => s + r.stars, 0)
    return (total / sessionsPlayed).toFixed(1)
  })()

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-chin overflow-hidden">
      {/* Cream play surface */}
      <div className="flex-1 min-h-0 mt-1.5 md:mt-2 flex flex-col bg-paper rounded-[28px] md:rounded-[36px] shadow-play-lift relative z-10 overflow-hidden">

        <header className="relative w-full max-w-3xl mx-auto px-4 pt-4 md:pt-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <button
              className="w-11 h-11 rounded-full flex items-center justify-center font-ui bg-white border border-tile-edge text-ink-muted hover:text-ink hover:shadow-tile-hover transition-all active:scale-95 shadow-tile"
              title="Menu"
              aria-label="Menu"
            >
              <span className="material-icons text-[22px]">menu</span>
            </button>
            <button
              className="w-11 h-11 rounded-full flex items-center justify-center font-ui bg-white border border-tile-edge text-ink-muted hover:text-ink hover:shadow-tile-hover transition-all active:scale-95 shadow-tile"
              title="How to play"
              aria-label="How to play"
            >
              <span className="material-icons text-[20px]">help_outline</span>
            </button>
          </div>
          <div className="absolute inset-x-0 top-4 md:top-6 h-11 flex items-center justify-center pointer-events-none">
            <AnimatedWordmark className="text-xl md:text-2xl text-ink" />
          </div>
        </header>

        <p className="text-center font-ui text-[11px] text-ink-soft uppercase tracking-[0.2em] mt-3">
          Daily word puzzle
        </p>

        <div className="flex-1 min-h-0 w-full max-w-md mx-auto px-5 md:px-6 mt-5 flex flex-col">

          {/* Hero card */}
          <div className="bg-tile-face border border-tile-edge rounded-[26px] px-5 py-5 text-center shadow-tile-lift">
            <p className="font-ui text-[11px] text-ink-soft uppercase tracking-[0.2em] mb-2">
              {easternHeaderDate(today)}
            </p>
            <p className="font-wide text-[44px] md:text-[46px] text-ink leading-none tracking-[-0.01em]">
              No. {formatPuzzleNumber(dn)}
            </p>
            <p className="font-clue text-[13px] text-ink-muted mt-3 inline-flex items-center gap-1.5">
              <span className="material-icons text-[16px] text-ink-soft">view_carousel</span>
              5 puzzles · Tier 1 → 3
            </p>
          </div>

          {/* Stat row */}
          <div className="grid grid-cols-3 mt-4 border border-tile-edge rounded-2xl bg-tile-face shadow-tile overflow-hidden">
            <StatCell
              tone="warm"
              icon="local_fire_department"
              filled
              value={streak === 0 ? '—' : streak.toString()}
              label="Streak"
            />
            <StatCell
              tone="gold"
              icon="star"
              filled
              value={avgStars ?? '—'}
              label="Avg ★"
            />
            <StatCell
              tone="accent"
              icon="grid_view"
              value={sessionsPlayed.toString()}
              label="Played"
            />
          </div>

          <div className="flex-1 min-h-4" />

          {/* Primary CTA */}
          <Link
            to="/play"
            className="font-ui flex items-center justify-center gap-2 bg-ink hover:bg-ink/85 text-surface px-7 py-4 rounded-full text-base shadow-tile transition-all active:scale-95"
          >
            {todaysSessionDone ? "View today's scorecard" : "Play today's session"}
            <span className="material-icons text-[20px]">
              {todaysSessionDone ? 'chevron_right' : 'arrow_forward'}
            </span>
          </Link>

          <div className="flex items-center justify-center mt-4 mb-3">
            <Link
              to="/archive"
              className="font-ui flex items-center gap-1.5 text-ink-muted hover:text-ink text-sm py-1.5"
            >
              <span className="material-icons text-[18px] text-ink-soft">history</span>
              Archive
            </Link>
          </div>
        </div>

        {/* Mention perfectSessions silently — not rendered, but available to V2 stats page */}
        {perfectSessions >= 0 && null}
      </div>

      {/* Chin */}
      <div
        className="flex-shrink-0 bg-chin text-surface relative"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="relative z-20 w-full max-w-3xl mx-auto px-5 md:px-7 pt-3 md:pt-4 pb-1 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className="material-icons text-black/60"
              style={{ fontSize: 26, fontVariationSettings: '"FILL" 0, "wght" 500, "GRAD" 0, "opsz" 24' }}
              aria-hidden="true"
            >
              avg_pace
            </span>
            <span className="font-expand text-[22px] md:text-2xl leading-none tabular-nums tracking-[-0.01em] text-surface">
              {formatCountdown(countdown)}
            </span>
          </div>
          <span className="font-ui text-[11px] tracking-[0.2em] uppercase text-surface/85">
            Next puzzle
          </span>
        </div>
      </div>
    </div>
  )
}

function StatCell({
  tone,
  icon,
  value,
  label,
  filled,
}: {
  tone: 'warm' | 'gold' | 'accent'
  icon: string
  value: string
  label: string
  filled?: boolean
}) {
  const toneBg = tone === 'warm'
    ? 'bg-[oklch(94%_0.04_38)] text-[oklch(64%_0.16_38)]'
    : tone === 'gold'
    ? 'bg-[oklch(95%_0.06_90)] text-[oklch(58%_0.13_90)]'
    : 'bg-accent-soft text-accent'
  return (
    <div className="text-center py-3.5 border-l border-tile-edge first:border-l-0">
      <span
        className={`inline-flex items-center justify-center w-[30px] h-[30px] rounded-full ${toneBg}`}
      >
        <span
          className="material-icons text-[18px]"
          style={filled ? { fontVariationSettings: '"FILL" 1, "wght" 500, "GRAD" 0, "opsz" 24' } : undefined}
        >
          {icon}
        </span>
      </span>
      <p className="font-expand text-[26px] text-ink leading-none mt-1.5">{value}</p>
      <p className="font-ui text-[10px] text-ink-soft uppercase tracking-[0.18em] mt-1.5">{label}</p>
    </div>
  )
}
