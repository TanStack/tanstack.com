import {createFileRoute} from '@tanstack/react-router'
import {handleKodyAccount} from '~/chat/server/kody-account-http.server'
export const Route=createFileRoute('/api/chat/kody/mail/messages/$messageId')({server:{handlers:{GET:({request,params})=>handleKodyAccount(request,'mail-messages',params.messageId)}}})
