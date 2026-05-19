import { createFileRoute } from '@tanstack/react-router'
import Archive from '@/components/Archive'

export const Route = createFileRoute('/archive')({
  component: Archive,
})
