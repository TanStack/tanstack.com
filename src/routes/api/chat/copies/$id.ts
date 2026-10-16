import {createFileRoute} from '@tanstack/react-router'
import {handleConversationCopy} from '~/chat/server/conversation-copy-http.server'
export const Route=createFileRoute('/api/chat/copies/$id')({server:{handlers:{GET:({request,params})=>handleConversationCopy(request,params.id,'operation')}}})
