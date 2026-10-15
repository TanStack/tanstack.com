import {createFileRoute} from '@tanstack/react-router'
import {handleBotDraft} from '~/chat/server/bot-draft-http.server'
export const Route=createFileRoute('/api/chat/bot-drafts/$id')({server:{handlers:{GET:({request,params})=>handleBotDraft(request,params.id),POST:({request,params})=>handleBotDraft(request,params.id)}}})
