import type { CSSProperties } from 'react'

/**
 * The app's mark set — Google's Material Symbols, rendered as ligatures.
 *
 * The eleven names below are the app's own vocabulary; `GLYPH` maps each one to
 * the Material ligature that draws it. Components never name a Material glyph
 * directly, so swapping a mark (or the whole family) is a one-line change here
 * rather than a sweep across 30 call sites.
 *
 * WEIGHT. Material's default `wght` is 400, which renders as a hairline next to
 * this app's type — the marks read as smudges beside a 700 tracked-caps eyebrow
 * or a 3px masthead rule. `DEFAULT_WEIGHT` is 600 so the furniture carries the
 * same ink as everything around it. Per-call overrides go through `weight`.
 *
 * OPTICAL SIZE. `opsz` is fed the rendered pixel size (clamped to the axis's
 * 20–48 range), so a 9px calendar star and a 34px close button are drawn by the
 * font at their own optical size rather than by scaling one master.
 *
 * LOADING. The stylesheet is requested with `display=block` (see __root.tsx):
 * until the font arrives the glyph is invisible rather than showing its
 * ligature text ("local_fire_department"). `.material-symbols` also pins the
 * box to 1em square with `overflow: hidden`, so even a hard font failure can
 * only ever clip — it can never reflow a header or a tile.
 *
 * Every mark is `aria-hidden` + non-selectable. Meaning is carried by adjacent
 * text or by an `aria-label` on the control — no mark here is the only label on
 * anything.
 */

export type IconName =
  // Structural — icon-only controls, no adjacent text to lean on.
  | 'menu'
  | 'close'
  | 'help'
  | 'chevron'
  | 'rotate'
  | 'flip'
  // Content tokens — these carry state, not navigation.
  | 'check'
  | 'star'
  | 'search'
  | 'flame'
  | 'clock'

/** App mark name → Material Symbols ligature. */
const GLYPH: Record<IconName, string> = {
  menu: 'menu',
  close: 'close',
  // A bare question mark rather than `help`, whose ringed glyph would put a
  // second concentric circle inside the circular button it always sits in.
  help: 'question_mark',
  // Base points left; `dir` rotates it.
  chevron: 'chevron_left',
  // Two arrows chasing each other, not one. `rotate_right` draws a single
  // sweep, which reads as "undo/redo" — a one-way move. The board turn is a
  // cycle you can keep taking, and two opposed arrowheads say that.
  rotate: 'sync',
  // The tile's halves trading places — two opposed vertical arrows.
  flip: 'swap_vert',
  check: 'check',
  star: 'star',
  search: 'search',
  flame: 'local_fire_department',
  clock: 'schedule',
}

export type IconProps = {
  name: IconName
  /** Rendered box in px. Also drives the font's `opsz` axis. */
  size?: number
  /** `chevron` only. The base glyph points left. */
  dir?: 'up' | 'right' | 'down' | 'left'
  /** `star` only — an earned star is solid, an unearned one is an outline. */
  filled?: boolean
  /** `wght` axis, 100–700. Defaults to DEFAULT_WEIGHT. */
  weight?: number
  className?: string
  style?: CSSProperties
}

/** Heavier than Material's 400 default — see the file header. */
const DEFAULT_WEIGHT = 600

/** The `opsz` axis only exists between these two values. */
const OPSZ_MIN = 20
const OPSZ_MAX = 48

const CHEVRON_ROTATION: Record<NonNullable<IconProps['dir']>, number> = {
  left: 0,
  up: 90,
  right: 180,
  down: 270,
}

export function Icon({
  name,
  size = 24,
  dir = 'left',
  filled = false,
  weight = DEFAULT_WEIGHT,
  className,
  style,
}: IconProps) {
  const rotation = name === 'chevron' ? CHEVRON_ROTATION[dir] : 0
  const opsz = Math.min(OPSZ_MAX, Math.max(OPSZ_MIN, size))

  return (
    <span
      className={className ? `material-symbols ${className}` : 'material-symbols'}
      aria-hidden="true"
      translate="no"
      style={{
        fontSize: `${size}px`,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${opsz}`,
        // Only emitted for a turned chevron, so nothing else pays for a
        // compositor layer it does not need.
        ...(rotation ? { transform: `rotate(${rotation}deg)` } : null),
        ...style,
      }}
    >
      {GLYPH[name]}
    </span>
  )
}
