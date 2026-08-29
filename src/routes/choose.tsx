import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import GameSelect from '@/components/GameSelect'
import { hasChosenEdition, useEdition } from '@/edition'
import type { Edition } from '@/edition'

// NOTE: this path is duplicated as GAME_SELECT_PATH in src/edition/context.tsx
// because the pre-paint boot script needs it as a literal. Rename both or none.
export const Route = createFileRoute('/choose')({
  component: ChooseRoute,
})

/**
 * The fork in the road — the app's default front door, always. Every full
 * page load of `/` lands here pre-paint (see `editionBootScript`; only an
 * explicit `?edition=` deep link skips it), and the title screen's "switch
 * games" link leads back. Returning players see their game badged "Now
 * playing"; choosing persists the edition and lands on that edition's normal
 * title screen.
 */
function ChooseRoute() {
  const navigate = useNavigate()
  const { edition, setEdition } = useEdition()

  // "Now playing" badge — only meaningful for someone who actually chose
  // before; a first-timer's resolved default is not their choice. Read after
  // mount so the SSR'd markup (which can't know) hydrates cleanly.
  const [current, setCurrent] = useState<Edition | null>(null)
  useEffect(() => {
    setCurrent(hasChosenEdition() ? edition : null)
    // Mount-only on purpose: while the visitor is mid-choice we don't want the
    // badge hopping to whatever they just clicked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <GameSelect
      current={current}
      onChoose={(id) => {
        setEdition(id)
        navigate({ to: '/' })
      }}
    />
  )
}
