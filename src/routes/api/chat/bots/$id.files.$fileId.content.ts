import {createFileRoute} from '@tanstack/react-router'
import {handleFiles} from '~/chat/server/file-http.server'
export const Route=createFileRoute('/api/chat/bots/$id/files/$fileId/content')({server:{handlers:{
GET: ({request,params}) => handleFiles(request, 'bots', params.id, params.fileId, true)
}}})
