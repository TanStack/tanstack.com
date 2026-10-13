import {createFileRoute} from '@tanstack/react-router'
import {handleFiles} from '~/chat/server/file-http.server'
export const Route=createFileRoute('/api/chat/bot-drafts/$id/files/$fileId')({server:{handlers:{
GET: ({request,params}) => handleFiles(request, 'bot-drafts', params.id, params.fileId),
POST: ({request,params}) => handleFiles(request, 'bot-drafts', params.id, params.fileId),
PUT: ({request,params}) => handleFiles(request, 'bot-drafts', params.id, params.fileId),
DELETE: ({request,params}) => handleFiles(request, 'bot-drafts', params.id, params.fileId)
}}})
