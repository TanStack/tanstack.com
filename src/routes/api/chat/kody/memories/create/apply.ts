import {createFileRoute} from '@tanstack/react-router'
import {handleKodyMemoryMutation} from '~/chat/server/kody-memory-http.server'
export const Route=createFileRoute('/api/chat/kody/memories/create/apply')({server:{handlers:{POST:({request})=>handleKodyMemoryMutation(request,'apply')}}})
