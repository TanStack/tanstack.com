import {createFileRoute} from '@tanstack/react-router'
import {handleFileImport} from '~/chat/server/file-http.server'
export const Route=createFileRoute('/api/chat/conversations/$id/files/import')({server:{handlers:{POST:({request,params})=>handleFileImport(request,params.id)}}})
