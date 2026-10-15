import {createFileRoute} from '@tanstack/react-router'
import {handleProviderConnection} from '~/chat/server/provider-connection-http.server'
export const Route=createFileRoute('/api/chat/connection')({server:{handlers:{POST:({request})=>handleProviderConnection(request)}}})
