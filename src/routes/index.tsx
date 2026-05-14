import { Link, createFileRoute } from '@tanstack/react-router'
import FlipWords from '../components/FlipWords'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-6xl justify-end px-4 pt-4">
        <Link to="/admin" className="text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900">
          Admin Review
        </Link>
      </div>
      <FlipWords />
    </div>
  )
}
