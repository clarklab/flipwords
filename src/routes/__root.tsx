import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'


import '../styles.css'

// Canonical production URL. Used as the basis for og:url, twitter URLs,
// and the absolute paths required by social scrapers (Facebook, Slack,
// iMessage, etc. don't always resolve relative /unfurl.webp correctly).
const SITE_URL = 'https://flipwords.superfun.games'
const SITE_TITLE = 'FlipWords'
const SITE_DESCRIPTION =
  'A word puzzle that flips, rotates, and clicks into place.'
const UNFURL_IMAGE = `${SITE_URL}/unfurl.webp`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { name: 'theme-color', content: '#1f9c93' },
      { title: SITE_TITLE },
      { name: 'description', content: SITE_DESCRIPTION },

      // Open Graph — used by Facebook, LinkedIn, Slack, Discord, iMessage.
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_TITLE },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:image', content: UNFURL_IMAGE },
      { property: 'og:image:width', content: '1731' },
      { property: 'og:image:height', content: '909' },
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
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,300..600,0..1,-25..0&display=swap',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
