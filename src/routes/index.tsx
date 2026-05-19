import { createFileRoute } from '@tanstack/react-router'
import TitleScreen from '@/components/TitleScreen'

export const Route = createFileRoute('/')({
  component: TitleScreen,
})
