import {createFileRoute} from '@tanstack/react-router'
import {handleSavedActions} from '~/chat/server/saved-actions-http.server'
export const Route=createFileRoute('/api/chat/recipes')({server:{handlers:{POST:({request})=>handleSavedActions(request)}}})
