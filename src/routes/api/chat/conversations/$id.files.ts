import {createFileRoute} from '@tanstack/react-router'
import {handleFiles} from '~/chat/server/file-http.server'
export const Route=createFileRoute('/api/chat/conversations/$id/files')({server:{handlers:{
GET: ({request,params}) => handleFiles(request, 'conversations', params.id),
POST: ({request,params}) => handleFiles(request, 'conversations', params.id),
PUT: ({request,params}) => handleFiles(request, 'conversations', params.id),
DELETE: ({request,params}) => handleFiles(request, 'conversations', params.id)
}}})
