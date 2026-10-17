import {createFileRoute} from '@tanstack/react-router'
import {handleConversationRetry} from '~/chat/server/conversation-retry-http.server'
export const Route=createFileRoute('/api/chat/retries/$id')({server:{handlers:{GET:({request,params})=>handleConversationRetry(request,params.id,'get')}}})
