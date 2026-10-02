import {createFileRoute} from '@tanstack/react-router'
import {handleSavedActions} from '~/chat/server/saved-actions-http.server'
export const Route=createFileRoute('/api/chat/recipes/$id')({server:{handlers:{DELETE:({request,params})=>handleSavedActions(request,params.id)}}})
