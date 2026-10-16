import { createFileRoute } from '@tanstack/react-router'
import { handleKodyCallback } from '~/chat/server/kody-callback-http.server'
export const Route = createFileRoute('/api/chat/kody/callback')({ server: { handlers: { GET: ({ request }) => handleKodyCallback(request) } } })
