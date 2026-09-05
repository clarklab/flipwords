import type { Level } from '@/game/types'
import type { EasternDate } from '@/daily/types'

/** The two shipping editions of the game. */
export type Edition = 'flipwords' | 'texas'

/**
 * A pool release gates which levels a given date's daily session may draw
 * from, so adding puzzles later never rewrites an already-played day.
 * See daily/schedule.ts for the full rationale.
 */
export type PoolRelease = { from: EasternDate; maxId: number }

/**
 * Everything that differs between editions, in one place.
 *
 * The rule this file exists to enforce: **no component, hook, or daily
 * function may hardcode an edition-specific string, key, color, or puzzle
 * source.** They read it from here. Adding a third edition should mean
 * adding one entry to `EDITIONS` and one `[data-edition]` block in CSS —
 * nothing else.
 */
export type EditionConfig = {
  id: Edition

  // ---- Identity -----------------------------------------------------------
  /** Full display name, e.g. "The Texas Two-Step". */
  name: string
  /** Short name for tight spaces (nav, share sheet, buttons). */
  shortName: string
  /** Wordmark string, rendered per-letter by AnimatedWordmark. */
  wordmark: string
  /** One-line deck shown under the wordmark. */
  tagline: string
  /** Meta description for SEO/unfurls. */
  description: string
  /** Publisher attribution, e.g. "By Texas Monthly". Null when unbranded. */
  byline: string | null
  /** Primary CTA on the title screen. */
  playLabel: string

  // ---- Puzzle library -----------------------------------------------------
  /** This edition's puzzles. Editions never share levels. */
  levels: Level[]
  /** Day 1 of this edition's puzzle numbering. */
  launchDate: EasternDate
  /** Date-gated pool growth, sorted by `from`. */
  poolReleases: PoolRelease[]
  /**
   * From this date on, the daily picker serves the least-recently-played
   * levels in each tier bucket instead of drawing uniformly, so no puzzle
   * repeats until every other eligible one has had a turn. Like a pool
   * release, this must never be back-dated: days before it keep their
   * original random deals. Omit to keep uniform draws forever.
   */
  noRepeatFrom?: EasternDate
  /**
   * Namespace for the daily RNG seed. Must be unique per edition — two
   * editions sharing a prefix would deal correlated sessions.
   */
  seedPrefix: string

  // ---- Persistence --------------------------------------------------------
  /**
   * localStorage key for this edition's progress. Must be unique per
   * edition, or streaks and in-progress sessions bleed across the toggle.
   */
  storageKey: string
  /** Where a corrupt blob is parked before being replaced. */
  backupKey: string

  // ---- Sharing ------------------------------------------------------------
  share: {
    /** Uppercase label in the share string, e.g. "TEXAS TWO-STEP". */
    headline: string
    /** Bare domain appended to the share text. */
    siteUrl: string
  }

  /**
   * Celebration confetti colors. Lives here because canvas-confetti paints to
   * a canvas and cannot read CSS custom properties.
   */
  confetti: string[]

  /**
   * Social preview card. Must depict THIS edition — a shared Texas link that
   * unfurls with FlipWords' artwork puts one brand's name over another's art.
   */
  unfurl: { src: string; width: number; height: number }

  // ---- Chrome -------------------------------------------------------------
  /**
   * Browser UI color. MUST equal the CSS `--chin` value for this edition
   * or a seam appears between the URL bar and the page.
   */
  themeColor: string
}
