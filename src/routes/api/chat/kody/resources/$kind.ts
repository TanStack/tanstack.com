import {createFileRoute} from '@tanstack/react-router'
import {handleKodyAccount} from '~/chat/server/kody-account-http.server'
export const Route=createFileRoute('/api/chat/kody/resources/$kind')({server:{handlers:{GET:({request,params})=>handleKodyAccount(request,'resources',params.kind)}}})
