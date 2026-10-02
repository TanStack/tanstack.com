import {createFileRoute} from '@tanstack/react-router'
import {handleReferences} from '~/chat/server/reference-http.server'
export const Route=createFileRoute('/api/chat/conversations/$id/references')({server:{handlers:{GET:({request,params})=>handleReferences(request,params.id)}}})
