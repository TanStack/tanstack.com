import {createFileRoute} from '@tanstack/react-router'
import {handleKodyControl} from '~/chat/server/kody-control-http.server'
export const Route=createFileRoute('/api/chat/kody/servers/$serverId/enabled')({server:{handlers:{POST:({request,params})=>handleKodyControl(request,'server-enabled',params.serverId)}}})
