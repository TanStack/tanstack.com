import { createFileRoute } from '@tanstack/react-router'
import { handleWorkspaceSections } from '~/chat/server/workspace-sections-http.server'
export const Route=createFileRoute('/api/chat/sections')({server:{handlers:{POST:({request})=>handleWorkspaceSections(request)}}})
