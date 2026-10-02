import {createFileRoute} from '@tanstack/react-router'
import {handleKodyControl} from '~/chat/server/kody-control-http.server'
export const Route=createFileRoute('/api/chat/kody/servers/$serverId/reconnect')({server:{handlers:{POST:({request,params})=>handleKodyControl(request,'server-reconnect',params.serverId)}}})
