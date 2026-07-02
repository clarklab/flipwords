import { useEffect, useState } from 'react'
import { easternDateString, msUntilNextRollover } from './date'

/**
 * The current Eastern calendar date, kept live across midnight. A timeout
 * fires just past the rollover; a visibilitychange re-check covers device
 * sleep outlasting any timer. Consumers re-render exactly once per flip.
 */
export function useEasternDate(): string {
  const [date, setDate] = useState(() => easternDateString())

  useEffect(() => {
    let timer: number | undefined

    const sync = () => {
      const now = easternDateString()
      setDate((prev) => (prev === now ? prev : now))
      window.clearTimeout(timer)
      // +250ms cushion so we land safely on the far side of midnight.
      timer = window.setTimeout(sync, msUntilNextRollover() + 250)
    }

    timer = window.setTimeout(sync, msUntilNextRollover() + 250)
    const onVisibility = () => {
      if (!document.hidden) sync()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return date
}
