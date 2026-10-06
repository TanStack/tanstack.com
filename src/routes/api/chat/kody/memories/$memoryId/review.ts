import {createFileRoute} from '@tanstack/react-router'
import {handleKodyMemoryMutation} from '~/chat/server/kody-memory-http.server'
export const Route=createFileRoute('/api/chat/kody/memories/$memoryId/review')({server:{handlers:{POST:({request,params})=>handleKodyMemoryMutation(request,'review',params.memoryId)}}})
