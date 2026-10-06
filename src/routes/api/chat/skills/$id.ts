import { createFileRoute } from '@tanstack/react-router'
import { handleSkills } from '../skills'

export const Route = createFileRoute('/api/chat/skills/$id')({
  server: {
    handlers: {
      GET: ({ request, params }) => handleSkills(request, params.id),
      POST: ({ request, params }) => handleSkills(request, params.id),
    },
  },
})
