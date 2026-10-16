import {createFileRoute} from '@tanstack/react-router'
import {handleKodyAccount} from '~/chat/server/kody-account-http.server'
export const Route=createFileRoute('/api/chat/kody/memories/$memoryId')({server:{handlers:{GET:({request,params})=>handleKodyAccount(request,'memories',params.memoryId)}}})
