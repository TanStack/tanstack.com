import {createFileRoute} from '@tanstack/react-router'
import {handleKodyMemoryMutation} from '~/chat/server/kody-memory-http.server'
export const Route=createFileRoute('/api/chat/kody/memories/$memoryId/apply')({server:{handlers:{POST:({request,params})=>handleKodyMemoryMutation(request,'apply',params.memoryId)}}})
