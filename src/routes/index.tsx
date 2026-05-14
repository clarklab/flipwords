import { createFileRoute } from '@tanstack/react-router'
import FlipWords from '../components/FlipWords'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="min-h-[100dvh] bg-paper relative">
      <FlipWords />
    </div>
  )
}
