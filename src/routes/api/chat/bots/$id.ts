import {createFileRoute} from '@tanstack/react-router'
import {handleBotMutation} from '~/chat/server/bot-mutation-http.server'
export const Route=createFileRoute('/api/chat/bots/$id')({server:{handlers:{PATCH:({request,params})=>handleBotMutation(request,params.id)}}})
