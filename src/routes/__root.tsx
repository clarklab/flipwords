import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import '../styles.css'
import {
  DEFAULT_EDITION,
  EDITIONS,
  EditionProvider,
  editionBootScript,
} from '@/edition'

// SSR head content describes the DEFAULT edition. The client may resolve to
// the other edition (URL param or remembered choice); the boot script below
// repaints the palette before first paint, and EditionProvider syncs
// theme-color afterwards. Crawlers see the default edition, which is what we
// want indexed.
const DEFAULT = EDITIONS[DEFAULT_EDITION]

// The ORIGIN THIS BUILD IS SERVED FROM — not the edition's brand address.
// `share.siteUrl` is display text for the share sheet ("texasmonthly.com/games")
// and must never be used here: deriving the origin from it made every page
// declare `canonical: https://texasmonthly.com` and point `og:image` at a file
// only this build has, so shared links rendered a blank card and told search
// engines the whole app duplicates someone else's homepage.
const SITE_URL = 'https://flipwords.superfun.games'
const SITE_TITLE = DEFAULT.name
const SITE_DESCRIPTION = DEFAULT.description
const UNFURL_IMAGE = `${SITE_URL}${DEFAULT.unfurl.src}`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { name: 'theme-color', content: DEFAULT.themeColor },
      { title: SITE_TITLE },
      { name: 'description', content: SITE_DESCRIPTION },

      // Open Graph — used by Facebook, LinkedIn, Slack, Discord, iMessage.
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_TITLE },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:image', content: UNFURL_IMAGE },
      { property: 'og:image:width', content: String(DEFAULT.unfurl.width) },
      { property: 'og:image:height', content: String(DEFAULT.unfurl.height) },
      { property: 'og:image:alt', content: SITE_DESCRIPTION },

      // Twitter / X — needs its own image + summary even though it largely
      // mirrors og:. summary_large_image renders the full-width preview.
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: SITE_TITLE },
      { name: 'twitter:description', content: SITE_DESCRIPTION },
      { name: 'twitter:image', content: UNFURL_IMAGE },
    ],
    links: [
      // Canonical URL — tells search engines and link-aggregators that
      // this is the authoritative address for the page, regardless of how
      // it's linked (utm params, mirror domains, etc.).
      { rel: 'canonical', href: SITE_URL },
      { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      { rel: 'apple-touch-icon', href: '/favicon.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Mona+Sans:ital,wdth,wght@0,75..125,200..900;1,75..125,200..900&display=swap',
      },
      // Material Symbols — the app's whole mark set (see components/Icon.tsx).
      // All four axes are requested because Icon drives three of them per call
      // site: FILL (earned stars), wght (marks run heavier than Material's 400
      // default), opsz (fed the rendered px size).
      // `display=block` rather than `swap`: these are ligatures, so a fallback
      // render shows the glyph's NAME as literal text ("local_fire_department")
      // rather than a plausible substitute. Block keeps the box empty until the
      // font lands; `.material-symbols` clamps it to 1em either way.
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    // data-edition is owned by the boot script below, which runs before
    // hydration. Rendering it here too produced a genuine hydration mismatch
    // on every load where the resolved edition differed from the default.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Sets data-edition from URL/localStorage before first paint so the
            remembered edition never flashes the default palette. */}
        <script dangerouslySetInnerHTML={{ __html: editionBootScript() }} />
      </head>
      <body>
        <EditionProvider>{children}</EditionProvider>
        <Scripts />
      </body>
    </html>
  )
}
