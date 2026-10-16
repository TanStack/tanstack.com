import {createFileRoute} from '@tanstack/react-router'
import {handleFiles} from '~/chat/server/file-http.server'
export const Route=createFileRoute('/api/chat/bot-drafts/$id/files')({server:{handlers:{
GET: ({request,params}) => handleFiles(request, 'bot-drafts', params.id),
POST: ({request,params}) => handleFiles(request, 'bot-drafts', params.id),
PUT: ({request,params}) => handleFiles(request, 'bot-drafts', params.id),
DELETE: ({request,params}) => handleFiles(request, 'bot-drafts', params.id)
}}})
