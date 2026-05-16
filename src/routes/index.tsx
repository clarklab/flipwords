import { createFileRoute } from '@tanstack/react-router'
import FlipWords from '../components/FlipWords'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-paper relative">
      <FlipWords />
    </div>
  )
}
