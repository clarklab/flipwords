import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from '@tanstack/react-router'
import AnimatedWordmark from './AnimatedWordmark'
import { Icon, type IconName } from './Icon'
import TutorialModal from './TutorialModal'
import WelcomeCarousel from './WelcomeCarousel'
import { dayNumber, msUntilNextRollover } from '@/daily/date'
import { EDITIONS, EDITION_IDS, useEdition } from '@/edition'
import { settleStreak } from '@/daily/streak'
import { useEasternDate } from '@/daily/useEasternDate'
import { useDailyStorage } from '@/daily/useDailyStorage'

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

// Sub-label flair: the middle word in "Daily ___ word puzzle" cycles through
// FLIP / FLOP / SWAP, each transitioning with a motion that matches its name —
// flip = horizontal-axis spin (rotateY), flop = vertical-axis spin (rotateX),
// swap = in-plane Z rotation. Width is pinned in `ch` so the surrounding
// "Daily ... word puzzle" doesn't reflow when the word changes. Defined above
// TitleScreen so Vite's React Fast Refresh transform (which converts function
// declarations to const-like bindings) doesn't break with a TDZ ReferenceError.
const FLIP_FLOP_SWAP_WORDS = [
  {
    word: 'FLIP',
    initial: { rotateY: 90, opacity: 0 },
    animate: { rotateY: 0, opacity: 1 },
    exit: { rotateY: -90, opacity: 0 },
  },
  {
    word: 'FLOP',
    initial: { rotateX: 90, opacity: 0 },
    animate: { rotateX: 0, opacity: 1 },
    exit: { rotateX: -90, opacity: 0 },
  },
  {
    word: 'SWAP',
    initial: { rotate: 90, opacity: 0 },
    animate: { rotate: 0, opacity: 1 },
    exit: { rotate: -90, opacity: 0 },
  },
] as const

function FlipFlopSwap() {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }
    // The rotating word is FlipWords' joke about its own mechanics. Under a
    // Texas Monthly masthead it means nothing, and mid-transition it leaves a
    // visible hole in the line. Rather than branch on an edition name — which
    // docs/edition-architecture.md forbids in components — the theme layer
    // publishes `--kicker-animate` and this reads it: 1 for FlipWords, 0 for
    // anything that would rather have a still line. The word itself is hidden
    // by `.tm-kicker-word`, so the timer is stopped here purely so a hidden
    // element does not re-render the page every two seconds.
    const animate = getComputedStyle(document.documentElement)
      .getPropertyValue('--kicker-animate')
      .trim()
    if (animate === '0') return
    const id = window.setInterval(
      () => setI((p) => (p + 1) % FLIP_FLOP_SWAP_WORDS.length),
      2000
    )
    return () => window.clearInterval(id)
  }, [])

  const current = FLIP_FLOP_SWAP_WORDS[i]

  return (
    <span
      className="tm-kicker-word inline-flex items-center justify-center align-baseline text-accent mx-[0.35em]"
      style={{
        perspective: 200,
        width: '4.6ch',
        height: '1em',
        verticalAlign: 'baseline',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={current.word}
          initial={current.initial}
          animate={current.animate}
          exit={current.exit}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="inline-block"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {current.word}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/**
 * The front door.
 *
 * Structure is deliberately identical in both editions — the divergence is all
 * token- or `[data-edition]`-driven (see src/styles/texas-title.css), so
 * FlipWords keeps the framed, pill-shaped, centered screen it ships today
 * while the Texas edition reads as a Texas Monthly Games page: didone masthead
 * over a heavy rule, letterspaced sub-nav on a hairline, a flat colour field
 * carrying the commissioned illustration, then eyebrow / headline / deck /
 * byline set flush left.
 */
export default function TitleScreen() {
  // Live Eastern date — flips at midnight so day number, CTA, and stats never
  // go stale in a long-lived tab.
  const { edition, config } = useEdition()

  // The other masthead this game is published under, named via the registry
  // rather than a literal (docs/edition-architecture.md). With more than two
  // editions the link would still read fine — it goes to the chooser either way.
  const otherEdition = EDITION_IDS.find((id) => id !== edition)
  const otherName = otherEdition ? EDITIONS[otherEdition].name : null
  const today = useEasternDate()
  const dn = dayNumber(today, config.launchDate)

  // Live storage with cross-tab sync. Settle the streak whenever the date
  // changes (mount + midnight rollover) so a missed-day reset shows at once.
  const { storage, update } = useDailyStorage(config)
  useEffect(() => {
    update((s) => settleStreak(s, today))
  }, [today, update])

  // Countdown ticker (60s cadence — good enough for `9h 37m`).
  const [countdown, setCountdown] = useState(msUntilNextRollover())
  useEffect(() => {
    const tick = () => setCountdown(msUntilNextRollover())
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const [showTutorial, setShowTutorial] = useState(false)
  // The masthead hamburger shipped with no onClick — a dead control, and the
  // first thing anyone clicks in a pitch. It now opens the two destinations
  // this app actually has, set as TM sets its own nav: tracked caps on rules.
  const [menuOpen, setMenuOpen] = useState(false)

  const todaysSessionDone = !!storage?.sessions[today]
  const streak = storage?.streak.current ?? 0
  const sessionsPlayed = storage?.totals.sessionsPlayed ?? 0
  const avgStars = (() => {
    if (!storage || sessionsPlayed === 0) return null
    const total = Object.values(storage.sessions).reduce((s, r) => s + r.stars, 0)
    return (total / sessionsPlayed).toFixed(1)
  })()

  return (
    <div className="app-shell h-[100dvh] w-full flex flex-col bg-chin overflow-hidden">
      {/* The page: a sheet floating on the chin. Under Texas texas-page.css
          dissolves this element entirely (`display: contents`) so the sections
          below become sections of the document. */}
      <div className="play-surface r-surface flex-1 min-h-0 mt-1.5 md:mt-2 flex flex-col bg-paper shadow-play-lift relative z-10 overflow-hidden">

        {/* MASTHEAD. TM's signature device is the heavy rule beneath it;
            `--rule-weight` keeps that a 1px hairline for FlipWords and a 3px
            black bar for Texas. Icon buttons stay genuinely circular — TM's
            own hamburger is a circle. */}
        <header className="tm-masthead relative w-full flex-shrink-0 rule-heavy">
          <div className="tm-container relative w-full max-w-3xl mx-auto px-4 pt-4 md:pt-5 pb-2.5 md:pb-3">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                className="w-11 h-11 rounded-full flex items-center justify-center font-ui bg-white border border-tile-edge fab-outline text-ink-muted hover:text-ink hover:shadow-tile-hover transition-all active:scale-95 shadow-tile"
                title="Menu"
                aria-label="Menu"
              >
                <Icon name={menuOpen ? 'close' : 'menu'} size={22} />
              </button>
              <button
                onClick={() => setShowTutorial(true)}
                className="w-11 h-11 rounded-full flex items-center justify-center font-ui bg-white border border-tile-edge fab-outline text-ink-muted hover:text-ink hover:shadow-tile-hover transition-all active:scale-95 shadow-tile"
                title="How to play"
                aria-label="How to play"
              >
                <Icon name="help" size={20} />
              </button>
            </div>
            <div className="tm-wordmark-slot absolute inset-x-0 top-4 md:top-5 h-11 flex items-center justify-center pointer-events-none">
              <AnimatedWordmark
                text={config.wordmark}
                className="tm-wordmark text-xl md:text-2xl text-ink"
              />
            </div>
          </div>
        </header>

        {/* SUB-NAV. TM sets its games sub-nav as small caps on a 0.18em track
            over a hairline — which is exactly the shape this line already had.
            `.tm-eyebrow` is a drop-in for the old inline treatment. */}
        <div className="tm-subnav-bar flex-shrink-0 rule-hair">
          <p className="tm-eyebrow tm-subnav tm-container text-center text-ink-soft py-2 md:py-2.5">
            Daily <FlipFlopSwap /> word puzzle
          </p>
        </div>

        {/* The nav the hamburger opens. Two real destinations, ruled and
            tracked the way TM sets its section nav. */}
        {menuOpen && (
          <nav className="tm-menu tm-container w-full max-w-3xl mx-auto px-5 md:px-6">
            <Link
              to="/archive"
              onClick={() => setMenuOpen(false)}
              className="tm-menu-item tm-eyebrow"
            >
              The archive
            </Link>
            <button
              type="button"
              className="tm-menu-item tm-eyebrow"
              onClick={() => {
                setMenuOpen(false)
                setShowTutorial(true)
              }}
            >
              How to play
            </button>
            <Link
              to="/choose"
              onClick={() => setMenuOpen(false)}
              className="tm-menu-item tm-eyebrow"
            >
              Switch games
            </Link>
          </nav>
        )}

        <div className="tm-lead tm-container flex-1 min-h-0 w-full max-w-md mx-auto px-5 md:px-6 mt-4 flex flex-col">

          {/* TODAY'S PUZZLE — a Games card: flat colour field with the
              illustration inside it, then eyebrow / headline / deck / byline.
              The field's artwork is supplied per edition from CSS so this
              markup never has to name an edition. */}
          <article className="tm-card">
            <div className="tm-hero-field r-tile" aria-hidden="true" />

            {/* The text half. A wrapper rather than five loose children, so
                the Texas desktop layout can set the card as a two-column grid
                — illustration beside the standfirst, TM's own card shape — with
                one rule instead of five explicit placements. Inert padding-and-
                margin-wise, so FlipWords' centred stack is unchanged. */}
            <div className="tm-lede">
              <p className="tm-eyebrow tm-kicker text-ink-soft">
                {easternHeaderDate(today)}
              </p>

              {/* Keyed on the day number: when midnight flips it, the number
                  pops in with a spring — the "new puzzle!" moment. */}
              <motion.p
                key={dn}
                initial={{ scale: 0.9, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                className="tm-puzzle-no font-display display-wide text-ink leading-none"
              >
                No. {formatPuzzleNumber(dn)}
              </motion.p>

              {/* Deck. Editorial serif, and only shown where the edition's page
                  furniture calls for one (see texas-title.css). */}
              <p className="tm-deck font-serif-text text-ink-muted">
                {config.tagline}
              </p>

              <div className="tm-credits">
                {config.byline && (
                  <span className="tm-byline font-ui text-[12px] text-ink-soft">
                    {config.byline}
                  </span>
                )}
                {/* "5 puzzles · Tier 1 → 3" was the generator's vocabulary on
                    the reader's page. No mark: this is a credit line, and the
                    sentence says the whole thing. */}
                <span className="tm-meta font-clue text-[13px] text-ink-muted inline-flex items-center gap-1.5">
                  Five puzzles, easing up in difficulty
                </span>
              </div>
            </div>
          </article>

          {/* Stat row — or welcome carousel for first-time visitors */}
          {sessionsPlayed === 0 ? (
            <WelcomeCarousel />
          ) : (
            <div className="tm-stats grid grid-cols-3 mt-4">
              <StatCell
                tone="warm"
                icon="flame"
                value={streak === 0 ? '—' : streak.toString()}
                label="Streak"
              />
              <StatCell
                tone="gold"
                icon="star"
                filled
                value={avgStars ?? '—'}
                label="Avg stars"
              />
              {/* Was `grid_view`. A tick is what "Played" actually means —
                  sessions finished — and it saves a twelfth mark. */}
              <StatCell
                tone="accent"
                icon="check"
                value={sessionsPlayed.toString()}
                label="Played"
              />
            </div>
          )}

          <div className="flex-1 min-h-3" />

          {/* Primary CTA */}
          <Link
            to="/play"
            className="tm-cta btn-primary font-ui flex items-center justify-center gap-2 bg-ink hover:bg-ink/85 text-surface px-7 py-4 r-btn text-base shadow-tile transition-all active:scale-95 border border-transparent"
          >
            {todaysSessionDone ? "View today's scorecard" : config.playLabel}
          </Link>

          {/* Secondary actions. A stacked button + link for FlipWords; Texas
              collapses the pair onto one line of underlined caps — TM's own
              "ALL NEWSLETTERS  PRIVACY POLICY" treatment. */}
          <div className="tm-actions">
            {/* Only when there's something to learn (i.e. not yet done today) */}
            {!todaysSessionDone && (
              <Link
                to="/play"
                search={{ tutorial: true }}
                className="tm-learn mt-3 font-ui flex items-center justify-center gap-2 bg-white border border-tile-edge text-ink-muted hover:text-ink py-4 r-btn text-base shadow-tile transition-all active:scale-95"
              >
                Learn to play
              </Link>
            )}

            <div className="tm-archive-row flex items-center justify-center mt-4">
              <Link
                to="/archive"
                className="tm-archive font-ui flex items-center gap-1.5 text-ink-muted hover:text-ink text-sm py-1.5"
              >
                Archive
              </Link>
            </div>
          </div>

          {/* The fork-in-the-road link that replaced the inline edition
              toggle: it names the game's other identity outright and leads
              back to the chooser, where either edition is one tap away. */}
          <div className="flex items-center justify-center mt-2 mb-3">
            <Link
              to="/choose"
              className="tm-switch font-ui text-[13px] text-ink-muted hover:text-ink underline decoration-1 underline-offset-4 py-1.5 px-2 text-center"
            >
              {otherName
                ? `Also published as ${otherName} — switch games`
                : 'Switch games'}
            </Link>
          </div>
        </div>

        {showTutorial && (
          <TutorialModal onComplete={() => setShowTutorial(false)} />
        )}
      </div>

      {/* Chin — under Texas this is a ruled caps line closing the column
          (see .page-meta), not an orange strip welded to the viewport. */}
      <div className="page-meta chin-safe flex-shrink-0 bg-chin relative">
        <div className="chin-row relative z-20 w-full max-w-3xl mx-auto px-5 md:px-7 pt-3 md:pt-4 pb-1 flex items-center justify-between gap-4">
          {/* Was a speedometer glyph beside the countdown. A speedometer is
              not a clock, and "Next puzzle in" already says it. */}
          <div className="flex items-center gap-2">
            {/* Mona Sans, not the display face: Grifinito's digits are
                proportional (196–312/1000 em), so a ticking didone countdown
                would visibly reflow. */}
            <span className="meta-figure font-expand text-[22px] md:text-2xl leading-none tabular-nums tracking-[-0.01em]">
              <span className="meta-label">Next puzzle in</span>
              {formatCountdown(countdown)}
            </span>
          </div>
          <span className="tm-eyebrow chin-dim tm-meta-trail">
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
  icon: IconName
  value: string
  label: string
  filled?: boolean
}) {
  return (
    <div className="tm-stat-cell text-center py-3.5">
      {/* Chip colours are token-derived so they follow the edition swap; they
          used to be three hardcoded oklch() literals that dragged FlipWords'
          teal and gold into the Texas palette. */}
      <span
        className={`tm-stat-chip stat-chip-${tone} inline-flex items-center justify-center w-[30px] h-[30px] rounded-full`}
      >
        <Icon name={icon} size={18} filled={filled} />
      </span>
      {/* Stays in Mona Sans: the empty-state placeholder is an em dash, which
          is outside the display face's 65-glyph trial charset. */}
      <p className="tm-stat-value font-expand text-[26px] text-ink leading-none mt-1.5">{value}</p>
      <p className="tm-eyebrow tm-eyebrow-sm text-ink-soft mt-1.5">{label}</p>
    </div>
  )
}
