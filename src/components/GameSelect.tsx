import { EDITIONS, EDITION_IDS } from '@/edition'
import type { Edition } from '@/edition'

/**
 * The fork in the road — the very first screen a new visitor sees.
 *
 * One daily word game ships under two mastheads, and a quiet toggle turned
 * out to read as a settings control rather than a choice of front door. This
 * screen makes the choice explicit: it says outright that the game has two
 * names, offers one large card per edition, and picking one drops you into
 * that edition's normal title screen.
 *
 * Deliberately registry-driven end to end (docs/edition-architecture.md):
 * every name, tagline, byline, and swatch below comes from `EDITIONS`, so a
 * third edition would appear here without touching this file.
 *
 * Presentational on purpose — the `/choose` route owns persisting the choice
 * and navigating, which keeps this component trivially testable.
 */
export default function GameSelect({
  onChoose,
  /** The edition the visitor is currently playing, if they've ever chosen. */
  current = null,
}: {
  onChoose: (id: Edition) => void
  current?: Edition | null
}) {
  return (
    <div className="app-shell min-h-[100dvh] w-full flex flex-col bg-chin">
      {/* Same floating sheet as the title screen; under Texas texas-page.css
          dissolves it and the page itself is the surface. No fixed 100dvh cage
          and no overflow-hidden: on a short viewport this screen scrolls, so
          the second card can never end up unreachable. */}
      <div className="play-surface r-surface flex-1 mt-1.5 md:mt-2 mb-1.5 md:mb-2 flex flex-col bg-paper shadow-play-lift relative z-10">
        <main className="tm-container w-full max-w-md mx-auto px-5 md:px-6 py-10 md:py-14 flex-1 flex flex-col justify-center">
          <header className="text-center">
            <p className="tm-eyebrow accent-type text-accent">Welcome</p>
            <h1 className="font-wide text-[28px] md:text-[32px] text-ink leading-tight mt-2">
              One game, two names
            </h1>
            <p className="font-serif-text text-[15px] text-ink-muted leading-relaxed mt-3">
              This daily word puzzle is published under two names. The rules
              are the same; each has its own look, its own puzzles, and its own
              streak. Pick the one you&rsquo;d like to play — you can switch
              any time from the title screen.
            </p>
          </header>

          <div className="mt-8 flex flex-col gap-4">
            {EDITION_IDS.map((id) => {
              const cfg = EDITIONS[id]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChoose(id)}
                  aria-label={`Play ${cfg.name}`}
                  className="gs-card group relative w-full text-left r-card border border-tile-edge bg-tile-face shadow-tile hover:shadow-tile-hover transition-all active:scale-[0.99] p-5 md:p-6"
                >
                  <span className="flex items-center justify-between">
                    {/* Each edition's confetti palette doubles as its swatch
                        strip — the one splash of that edition's colour on an
                        otherwise neutral screen. */}
                    <span className="flex gap-1.5" aria-hidden="true">
                      {cfg.confetti.map((c) => (
                        <span
                          key={c}
                          className="size-2.5 rounded-full border border-ink/10"
                          style={{ background: c }}
                        />
                      ))}
                    </span>
                    {current === id && (
                      <span className="tm-eyebrow tm-eyebrow-sm text-accent accent-type">
                        Now playing
                      </span>
                    )}
                  </span>

                  <span className="font-wide text-[22px] md:text-2xl text-ink block mt-3 leading-tight">
                    {cfg.name}
                  </span>
                  {cfg.byline && (
                    <span className="font-ui text-[12px] text-ink-soft block mt-0.5">
                      {cfg.byline}
                    </span>
                  )}
                  <span className="font-clue text-[13px] text-ink-muted block mt-1.5">
                    {cfg.tagline}
                  </span>

                  <span className="btn-primary font-ui inline-flex items-center gap-2 bg-ink group-hover:bg-ink/85 text-surface px-5 py-2.5 r-btn text-sm mt-4 transition-colors">
                    Play {cfg.shortName}
                  </span>
                </button>
              )
            })}
          </div>
        </main>
      </div>
    </div>
  )
}
