import {createFileRoute} from '@tanstack/react-router'
import {handleFiles} from '~/chat/server/file-http.server'
export const Route=createFileRoute('/api/chat/conversations/$id/files/$fileId')({server:{handlers:{
GET: ({request,params}) => handleFiles(request, 'conversations', params.id, params.fileId),
POST: ({request,params}) => handleFiles(request, 'conversations', params.id, params.fileId),
PUT: ({request,params}) => handleFiles(request, 'conversations', params.id, params.fileId),
DELETE: ({request,params}) => handleFiles(request, 'conversations', params.id, params.fileId)
}}})
