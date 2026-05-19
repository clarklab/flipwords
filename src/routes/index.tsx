import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import FlipWords from '../components/FlipWords'
import { getSessionForDate } from '@/daily/schedule'
import { easternDateString, dayNumber } from '@/daily/date'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const today = useMemo(() => easternDateString(), [])
  const session = useMemo(() => getSessionForDate(today), [today])
  const dn = useMemo(() => dayNumber(today), [today])
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
      <FlipWords
        session={session}
        mode="daily"
        date={today}
        dayNumber={dn}
      />
    </div>
  )
}
