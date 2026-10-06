import {createFileRoute} from '@tanstack/react-router'
import {handleFiles} from '~/chat/server/file-http.server'
export const Route=createFileRoute('/api/chat/bots/$id/files')({server:{handlers:{
GET: ({request,params}) => handleFiles(request, 'bots', params.id),
POST: ({request,params}) => handleFiles(request, 'bots', params.id),
PUT: ({request,params}) => handleFiles(request, 'bots', params.id),
DELETE: ({request,params}) => handleFiles(request, 'bots', params.id)
}}})
