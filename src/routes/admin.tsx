import { createFileRoute, Link } from '@tanstack/react-router'
import { allLevels, getLevelHintPattern, getSolvedEdgeAnswers } from '@/components/FlipWords'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

function AdminPage() {
  const tierCount = {
    1: allLevels.filter((l) => (l.tier ?? 1) === 1).length,
    2: allLevels.filter((l) => l.tier === 2).length,
    3: allLevels.filter((l) => l.tier === 3).length,
  }
  const rotatedCount = allLevels.filter((l) => l.requiresRotation).length

  return (
    <main className="min-h-[100dvh] bg-paper p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-baseline justify-between gap-y-2 border-b border-paper-line/40 pb-5">
          <div>
            <h1 className="font-wide text-3xl md:text-4xl text-ink">PUZZLE LIBRARY</h1>
            <p className="font-clue text-sm text-ink-muted mt-2">
              All {allLevels.length} levels, with clue text, solved edges, and the hint walkthrough.
            </p>
            <p className="font-ui text-xs text-ink-soft mt-1 uppercase tracking-[0.16em]">
              Tier 1: {tierCount[1]} · Tier 2: {tierCount[2]} · Tier 3: {tierCount[3]} · Rotated: {rotatedCount}
            </p>
          </div>
          <Link
            to="/"
            className="font-ui text-sm text-ink-muted hover:text-ink underline decoration-paper-line decoration-1 underline-offset-4"
          >
            ← Back to game
          </Link>
        </header>

        <section className="grid gap-4">
          {allLevels.map((level) => {
            const slot0 = `${level.solution.slot0Top}/${level.solution.slot0Bottom}`
            const slot1 = `${level.solution.slot1Top}/${level.solution.slot1Bottom}`
            const solvedEdges = getSolvedEdgeAnswers(level)
            const hintPattern = getLevelHintPattern(level)

            return (
              <article
                key={level.id}
                className="rounded-2xl border border-tile-edge bg-tile-face/80 backdrop-blur-sm p-5 shadow-tile"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="font-expand text-lg text-ink">Puzzle {level.id}</h2>
                  <span className="font-ui rounded-full bg-surface-deep/40 px-2.5 py-0.5 text-[11px] text-ink-muted uppercase tracking-wide">
                    Tier {level.tier ?? 1}
                  </span>
                  <span
                    className={`font-ui rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${
                      level.requiresRotation
                        ? 'bg-accent-soft text-accent'
                        : 'bg-surface-deep/40 text-ink-muted'
                    }`}
                  >
                    {level.requiresRotation ? 'Rotation' : 'Upright'}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 font-clue text-sm text-ink md:grid-cols-2">
                  <p>
                    <span className="font-ui text-ink-muted uppercase text-[10px] tracking-wider">Top</span><br />
                    {level.hints.topRow}
                  </p>
                  <p>
                    <span className="font-ui text-ink-muted uppercase text-[10px] tracking-wider">Bottom</span><br />
                    {level.hints.bottomRow}
                  </p>
                  <p>
                    <span className="font-ui text-ink-muted uppercase text-[10px] tracking-wider">Left</span><br />
                    {level.hints.leftCol}
                  </p>
                  <p>
                    <span className="font-ui text-ink-muted uppercase text-[10px] tracking-wider">Right</span><br />
                    {level.hints.rightCol}
                  </p>
                </div>

                <div className="mt-4 border-t border-paper-line/40 pt-3 font-clue text-sm text-ink">
                  <p>
                    <span className="font-ui text-ink-muted uppercase text-[10px] tracking-wider">Slot 1</span> {slot0} <span className="text-ink-soft">·</span> <span className="font-ui text-ink-muted uppercase text-[10px] tracking-wider">Slot 2</span> {slot1}
                  </p>
                  <div className="mt-2 grid gap-1 md:grid-cols-2">
                    <p>
                      <span className="font-ui text-accent uppercase text-[10px] tracking-wider">Top answer</span> {solvedEdges.top}
                    </p>
                    <p>
                      <span className="font-ui text-accent uppercase text-[10px] tracking-wider">Bottom answer</span> {solvedEdges.bottom}
                    </p>
                    <p>
                      <span className="font-ui text-accent uppercase text-[10px] tracking-wider">Left answer</span> {solvedEdges.left}
                    </p>
                    <p>
                      <span className="font-ui text-accent uppercase text-[10px] tracking-wider">Right answer</span> {solvedEdges.right}
                    </p>
                  </div>
                  <details className="mt-3 rounded-lg bg-surface-deep/30 p-3">
                    <summary className="font-ui text-xs text-ink-muted cursor-pointer hover:text-ink">Hint walkthrough</summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-muted text-sm">
                      {hintPattern.map((step, index) => (
                        <li key={`${level.id}-${index}`}>
                          <span className="font-ui text-ink">{step.action}:</span> {step.text}
                        </li>
                      ))}
                    </ol>
                  </details>
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}
