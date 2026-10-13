import { createFileRoute } from '@tanstack/react-router'
import { handleKodyConnect } from '~/chat/server/kody-connect-http.server'
export const Route = createFileRoute('/api/chat/kody/connect')({ server: { handlers: { POST: ({ request }) => handleKodyConnect(request) } } })
