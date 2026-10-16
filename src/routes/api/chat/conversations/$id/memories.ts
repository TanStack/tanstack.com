import {createFileRoute} from '@tanstack/react-router'
import {handleMemory} from '~/chat/server/memory-http.server'
export const Route=createFileRoute('/api/chat/conversations/$id/memories')({server:{handlers:{GET:({request,params})=>handleMemory(request,params.id),POST:({request,params})=>handleMemory(request,params.id)}}})
