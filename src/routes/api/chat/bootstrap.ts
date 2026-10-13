import { createFileRoute } from '@tanstack/react-router'
import { handleBootstrap } from '~/chat/server/bootstrap-http.server'
export const Route = createFileRoute('/api/chat/bootstrap')({server:{handlers:{GET:({request})=>handleBootstrap(request)}}})
