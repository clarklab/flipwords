import { createFileRoute } from '@tanstack/react-router'
import { allLevels, getLevelHintPattern, getSolvedEdgeAnswers } from '@/components/FlipWords'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Puzzle Admin Review</h1>
          <p className="text-sm text-slate-600 md:text-base">
            All {allLevels.length} puzzles with hint text and written solution words.
          </p>
        </header>

        <section className="grid gap-4">
          {allLevels.map((level) => {
            const slot0 = `${level.solution.slot0Top}/${level.solution.slot0Bottom}`
            const slot1 = `${level.solution.slot1Top}/${level.solution.slot1Bottom}`
            const solvedEdges = getSolvedEdgeAnswers(level)
            const hintPattern = getLevelHintPattern(level)

            return (
              <article key={level.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h2 className="text-lg font-semibold text-slate-900">Puzzle {level.id}</h2>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    {level.requiresRotation ? 'Needs rotation (90deg)' : 'No rotation needed'}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                  <p>
                    <span className="font-semibold text-slate-900">Top row:</span> {level.hints.topRow}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">Bottom row:</span> {level.hints.bottomRow}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">Left column:</span> {level.hints.leftCol}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">Right column:</span> {level.hints.rightCol}
                  </p>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-800">
                  <p>
                    <span className="font-semibold text-slate-900">Tile placement:</span> Slot 1 = {slot0}, Slot 2 = {slot1}
                  </p>
                  <div className="mt-2 grid gap-1 md:grid-cols-2">
                    <p>
                      <span className="font-semibold text-slate-900">Top row answer:</span> {solvedEdges.top}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Bottom row answer:</span> {solvedEdges.bottom}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Left column answer:</span> {solvedEdges.left}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Right column answer:</span> {solvedEdges.right}
                    </p>
                  </div>
                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <p className="font-semibold text-slate-900">Complete hint pattern:</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
                      {hintPattern.map((step, index) => (
                        <li key={`${level.id}-${index}`}>
                          <span className="font-semibold">{step.action}:</span> {step.text}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}
