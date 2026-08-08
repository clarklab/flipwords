import type { Level } from '@/game/types'
import type { Edition, EditionConfig } from './types'
import flipwordsLevels from '../../levels_generated.json'
import texasLevels from '../../levels_texas.json'

/**
 * The edition registry — the single source of truth for everything that
 * differs between FlipWords and the Texas Monthly edition.
 *
 * Invariants worth preserving:
 *   • `storageKey` is unique per edition (else streaks bleed on a game switch)
 *   • `seedPrefix` is unique per edition (else sessions correlate)
 *   • `themeColor` matches the `--chin` value in that edition's CSS block
 *   • `poolReleases` is sorted by `from` and never gains a past-dated entry
 */
export const EDITIONS: Record<Edition, EditionConfig> = {
  flipwords: {
    id: 'flipwords',
    name: 'FlipWords',
    shortName: 'FlipWords',
    wordmark: 'FLIPWORDS',
    tagline: 'A word puzzle that flips, rotates, and clicks into place.',
    description: 'A word puzzle that flips, rotates, and clicks into place.',
    byline: null,
    playLabel: 'Play FLIPWORDS',

    levels: flipwordsLevels as Level[],
    launchDate: '2026-05-18',
    poolReleases: [
      { from: '2026-05-18', maxId: 101 },
      { from: '2026-07-03', maxId: 151 },
    ],
    seedPrefix: 'flipwords',

    storageKey: 'flipwords_daily_v1',
    backupKey: 'flipwords_daily_backup',

    share: {
      headline: 'FLIPWORDS',
      siteUrl: 'flipwords.superfun.games',
    },

    unfurl: { src: '/unfurl.webp', width: 1731, height: 909 },

    confetti: ['#1f9c93', '#f7c454', '#e07a5f', '#3d405b', '#f4f1de'],

    themeColor: '#1f9c93',
  },

  texas: {
    id: 'texas',
    name: 'The Texas Two-Step',
    shortName: 'Texas Two-Step',
    wordmark: 'TEXAS TWO STEP',
    tagline: 'Two tiles, four answers, one state.',
    description:
      'A daily word puzzle about Texas, from Texas Monthly. Two tiles, four answers.',
    byline: 'By Texas Monthly',
    playLabel: 'Play Today’s Puzzle',

    levels: texasLevels as Level[],
    // The Texas edition numbers its own puzzles from its own day one.
    launchDate: '2026-08-03',
    // Pinned to the shipped max id, NOT an open ceiling. An unbounded maxId
    // would let puzzle 47 retroactively re-deal every already-played day.
    // To add puzzles: append above id 46, then add a future-dated entry here.
    poolReleases: [{ from: '2026-08-03', maxId: 1046 }],
    seedPrefix: 'texastwostep',

    storageKey: 'texas_two_step_daily_v1',
    backupKey: 'texas_two_step_daily_backup',

    share: {
      headline: 'TEXAS TWO-STEP',
      siteUrl: 'texasmonthly.com/games',
    },

    unfurl: { src: '/texas/unfurl-texas.webp', width: 1200, height: 630 },

    // Sampled from TM's Games illustrations + art.png.
    confetti: ['#e56545', '#f9e261', '#f58537', '#93c6c7', '#f9f0dd'],

    // The Texas edition no longer has a chin: the orange strip welded to the
    // viewport bottom was the app shell, and it is gone (see
    // src/styles/texas-page.css). The invariant is really "whatever the browser
    // chrome abuts", and that is now TM's page white, top and bottom.
    // Leaving this at #f58537 would paint an orange URL bar above a white page
    // — the exact seam the invariant exists to prevent.
    themeColor: '#ffffff',
  },
}

export const EDITION_IDS = Object.keys(EDITIONS) as Edition[]

/**
 * Fallback when nothing else resolves. The Texas edition is the pitch default,
 * but the FlipWords origin must keep serving FlipWords — otherwise every
 * first-time visitor to the shipping product lands in Texas Monthly branding
 * and the domain gets indexed as a TM property.
 */
export const DEFAULT_EDITION: Edition = 'texas'

/** Hosts that must always resolve to a specific edition, whatever the default. */
export const EDITION_BY_HOST: Record<string, Edition> = {
  'flipwords.superfun.games': 'flipwords',
  'www.flipwords.superfun.games': 'flipwords',
}

export function editionForHost(hostname: string | undefined): Edition | null {
  if (!hostname) return null
  return EDITION_BY_HOST[hostname] ?? null
}

/** Narrowing guard for values arriving from URLs and localStorage. */
export function isEdition(value: unknown): value is Edition {
  return typeof value === 'string' && value in EDITIONS
}

export function getEdition(id: Edition): EditionConfig {
  return EDITIONS[id]
}
