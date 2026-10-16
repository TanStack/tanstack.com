import {createFileRoute} from '@tanstack/react-router'
import {handleKodyUnlink} from '~/chat/server/kody-unlink-http.server'
export const Route=createFileRoute('/api/chat/kody/unlink')({server:{handlers:{POST:({request})=>handleKodyUnlink(request)}}})
