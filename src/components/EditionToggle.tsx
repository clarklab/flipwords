import { motion } from 'framer-motion'
import { EDITIONS, EDITION_IDS, useEdition } from '@/edition'
import type { Edition } from '@/edition'
import { cn } from '@/lib/utils'

/**
 * Edition switcher. Styled entirely from theme tokens, so it inherits whichever
 * palette and corner language is active rather than needing an edition-specific
 * variant: `.r-pill` is a full pill under FlipWords and a 2px square under
 * Texas Monthly, which turns the same control into a segmented tab strip.
 *
 * Rendered as a real radiogroup so it's keyboard- and screen-reader-operable:
 * arrow keys move between options, and the active option is the only tab stop.
 */
export default function EditionToggle({ className }: { className?: string }) {
  const { edition, setEdition } = useEdition()

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = EDITION_IDS.indexOf(edition)
    const next = e.key === 'ArrowRight' ? i + 1 : i - 1
    setEdition(EDITION_IDS[(next + EDITION_IDS.length) % EDITION_IDS.length])
  }

  return (
    <div
      role="radiogroup"
      aria-label="Choose edition"
      onKeyDown={onKeyDown}
      className={cn(
        'tm-edition-toggle relative inline-flex items-center r-pill p-1',
        'border border-ink/15 bg-ink/[0.04]',
        className
      )}
    >
      {EDITION_IDS.map((id: Edition) => {
        const active = id === edition
        return (
          <button
            key={id}
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => setEdition(id)}
            className={cn(
              'relative z-10 px-4 py-1.5 r-pill whitespace-nowrap',
              'font-ui text-[10px] uppercase tracking-[0.16em] transition-colors',
              active ? 'text-surface' : 'text-ink-muted hover:text-ink'
            )}
          >
            {active && (
              <motion.span
                layoutId="edition-toggle-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 -z-10 r-pill bg-ink"
              />
            )}
            {EDITIONS[id].shortName}
          </button>
        )
      })}
    </div>
  )
}
