import {createFileRoute} from '@tanstack/react-router'
import {handleKodyControl} from '~/chat/server/kody-control-http.server'
export const Route=createFileRoute('/api/chat/kody/servers')({server:{handlers:{POST:({request})=>handleKodyControl(request,'server-add')}}})
