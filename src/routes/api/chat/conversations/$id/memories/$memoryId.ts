import {createFileRoute} from '@tanstack/react-router'
import {handleMemory} from '~/chat/server/memory-http.server'
export const Route=createFileRoute('/api/chat/conversations/$id/memories/$memoryId')({server:{handlers:{GET:({request,params})=>handleMemory(request,params.id,params.memoryId),POST:({request,params})=>handleMemory(request,params.id,params.memoryId)}}})
