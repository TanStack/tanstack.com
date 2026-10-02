import { createFileRoute } from '@tanstack/react-router'
import { handleWorkspaceSections } from '~/chat/server/workspace-sections-http.server'
export const Route=createFileRoute('/api/chat/sections/$id')({server:{handlers:{PATCH:({request,params})=>handleWorkspaceSections(request,params.id),DELETE:({request,params})=>handleWorkspaceSections(request,params.id)}}})
