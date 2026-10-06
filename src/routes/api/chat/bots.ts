import {createFileRoute} from '@tanstack/react-router'
import {handleBotMutation} from '~/chat/server/bot-mutation-http.server'
export const Route=createFileRoute('/api/chat/bots')({server:{handlers:{POST:({request})=>handleBotMutation(request)}}})
