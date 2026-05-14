import { Link, createFileRoute } from '@tanstack/react-router'
import FlipWords from '../components/FlipWords'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="min-h-[100dvh] bg-paper relative">
      <div className="absolute top-4 right-4 z-50 md:top-6 md:right-6 pointer-events-none">
        <Link
          to="/admin"
          className="font-ui pointer-events-auto text-[11px] md:text-xs text-ink-soft hover:text-ink underline decoration-paper-line decoration-1 underline-offset-4 transition-colors"
        >
          Admin
        </Link>
      </div>
      <FlipWords />
    </div>
  )
}
