import type { CSSProperties } from 'react'

/**
 * The app's own mark set — eleven hairline SVGs drawn to one system.
 *
 * Replaces Material Symbols Outlined, which was 29 distinct glyphs pulled live
 * from fonts.googleapis.com. Two problems with that: the font is the single
 * most recognisable generic-app fingerprint in existence (a `school`
 * mortarboard next to "Learn to play", a speedometer next to a countdown), and
 * every screen paid a blocking third-party stylesheet for it.
 *
 * The drawing system, taken off Texas Monthly's own reference marks (search,
 * hamburger, share, bookmark, comment, chevron):
 *
 *   - ONE stroke weight, optically constant. `strokeWidth` is user units in a
 *     24×24 box, so a fixed value would render 0.6px at 11 and 2.1px at 38.
 *     The exponent below holds the *rendered* weight to ~1.0px at 11, 1.35px
 *     at 24 and 1.6px at 38 — the way an optical size axis behaves, not the
 *     way a scaled vector does.
 *   - Generous: marks fill 60–72% of the box. TM sets its furniture large and
 *     light; a small mark at this weight reads as a smudge.
 *   - Geometric: circles are circles, lines are straight, nothing is filled
 *     except the two content tokens that must survive at 9px (star, and the
 *     dot of the question mark, which is punctuation rather than line work).
 *   - Round caps and joins. TM's own marks are mitered, but at 1.35px the
 *     difference is sub-pixel everywhere except the star's points, and round
 *     is the one setting that also serves FlipWords' softer register. One
 *     system, both editions.
 *
 * Every mark is `aria-hidden` + `focusable="false"`. Meaning is carried by
 * adjacent text or by an `aria-label` on the control — no mark here is the
 * only label on anything.
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

export type IconProps = {
  name: IconName
  /** Rendered box in px. Stroke weight compensates; see BASE_STROKE. */
  size?: number
  /** `chevron` only. The base path points left. */
  dir?: 'up' | 'right' | 'down' | 'left'
  /** `star` only — an earned star is solid, an unearned one is an outline. */
  filled?: boolean
  className?: string
  style?: CSSProperties
}

/** Rendered stroke in px at size 24. */
const BASE_STROKE = 1.35

/**
 * Rendered px = BASE_STROKE · (size/24)^0.35 — weight creeps up with size the
 * way an optical axis does. Converting that to user units (× 24/size) leaves
 * the exponent below.
 */
function strokeFor(size: number) {
  return Number((BASE_STROKE * Math.pow(size / 24, -0.65)).toFixed(3))
}

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
  className,
  style,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeFor(size)}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      // block, so the mark never sits on a text baseline and drags a
      // descender gap into the flex rows it lives in.
      style={{ display: 'block', ...style }}
    >
      {mark(name, dir, filled)}
    </svg>
  )
}

function mark(name: IconName, dir: NonNullable<IconProps['dir']>, filled: boolean) {
  switch (name) {
    /* Three rules, full width, evenly spaced — TM's masthead hamburger. The
       enclosing circle is the button's border, not part of the mark. */
    case 'menu':
      return (
        <>
          <path d="M3.4 7H20.6" />
          <path d="M3.4 12H20.6" />
          <path d="M3.4 17H20.6" />
        </>
      )

    case 'close':
      return (
        <>
          <path d="M6.2 6.2 17.8 17.8" />
          <path d="M17.8 6.2 6.2 17.8" />
        </>
      )

    /* A bare question mark, not Material's `help_outline`. Both help controls
       are already circular buttons with a hairline border, so a ringed glyph
       put two concentric circles on screen — the exact "template" tell. Set
       large (63% of the box) to hold its own beside the hamburger, which is
       the only other mark that ever shares a masthead with it. The dot is
       filled: at 20px an outlined 2px ring is a blob, not a point. */
    case 'help':
      return (
        <>
          <path d="M7.8 8.49C7.8 6.19 9.64 4.53 12 4.53C14.36 4.53 16.2 6.19 16.2 8.38C16.2 11.25 12 11.65 12 12.69V15.34" />
          <circle cx="12" cy="18.56" r="1.09" fill="currentColor" stroke="none" />
        </>
      )

    /* One path, rotated. A `<` is symmetric about its own stroke centroid, so
       box-centring and optical centring coincide — no nudge needed. */
    case 'chevron':
      return (
        <g transform={`rotate(${CHEVRON_ROTATION[dir]} 12 12)`}>
          <path d="M15 5.6 8.9 12 15 18.4" />
        </g>
      )

    /* 290° of circle, break in the upper right, open arrowhead where the sweep
       ENDS — at the top, tangent, pointing clockwise. Drawing the head at the
       start instead (which is what reads naturally when you write the arc first)
       puts the barbs on the tail and the whole mark reads as a stray tick. */
    case 'rotate':
      return (
        <>
          <path d="M18.2 10.74A6.6 6.6 0 1 1 12 6.4" />
          <path d="M9.2 4.05 12 6.4 9.2 8.75" />
        </>
      )

    /* Two opposed arrows — the tile's halves trading places. */
    case 'flip':
      return (
        <>
          <path d="M8.8 18.4V5.6" />
          <path d="M5.9 8.5 8.8 5.6 11.7 8.5" />
          <path d="M15.2 5.6V18.4" />
          <path d="M12.3 15.5 15.2 18.4 18.1 15.5" />
        </>
      )

    case 'check':
      return <path d="M4.8 12.6 9.8 17.6 19.2 6.4" />

    /* Five-point star, outer r 8.4 / inner r 3.55, dropped 0.8 below the box
       centre so the two lower points sit on the optical centre line. Earned
       stars fill; the stroke stays on so a 9px calendar star keeps the same
       silhouette as the 38px scorecard one. */
    case 'star':
      return (
        <path
          d="M12 4.4 14.09 9.93 19.99 10.21 15.38 13.9 16.94 19.6 12 16.35 7.06 19.6 8.62 13.9 4.01 10.21 9.91 9.93Z"
          fill={filled ? 'currentColor' : 'none'}
        />
      )

    /* TM's own header mark: a generous circle with a short tangential handle —
       theirs runs about 40% of the lens diameter, not the half-length stub
       Material draws. */
    case 'search':
      return (
        <>
          <circle cx="11.1" cy="11.1" r="5.95" />
          <path d="M15.3 15.3 18.8 18.8" />
        </>
      )

    /* Leaning tip, one shoulder notch, round base. A symmetric flame with a
       smooth apex is a water droplet — the lean and the notch are the whole
       difference, and they have to survive down to 18px. */
    case 'flame':
      return (
        <path d="M12.3 4.1C13.4 7.5 15.6 9.1 16.8 11.5C18.2 14.5 16.2 19.6 12 19.6C8.2 19.6 6 16.7 6.5 13.5C6.8 11.6 8.1 10.2 9.5 8.4C9.8 10.3 10.7 11.2 11.8 11.7C13 10.2 12.8 6.9 12.3 4.1Z" />
      )

    /* Marks a session played after its day. Deliberately a plain clock rather
       than Material's `history` (clock plus a counter-clockwise arrow): the
       badge renders at 8px, where the second element is mud. */
    case 'clock':
      return (
        <>
          <circle cx="12" cy="12" r="7.4" />
          <path d="M12 7.4V12.2L15.4 14.1" />
        </>
      )
  }
}
