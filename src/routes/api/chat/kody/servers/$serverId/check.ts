import {createFileRoute} from '@tanstack/react-router'
import {handleKodyControl} from '~/chat/server/kody-control-http.server'
export const Route=createFileRoute('/api/chat/kody/servers/$serverId/check')({server:{handlers:{POST:({request,params})=>handleKodyControl(request,'server-check',params.serverId)}}})
