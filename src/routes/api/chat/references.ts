import {createFileRoute} from '@tanstack/react-router'
import {handleReferences} from '~/chat/server/reference-http.server'
export const Route=createFileRoute('/api/chat/references')({server:{handlers:{GET:({request})=>handleReferences(request)}}})
