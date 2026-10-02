import {createFileRoute} from '@tanstack/react-router'
import {handleKodyAccount} from '~/chat/server/kody-account-http.server'
export const Route=createFileRoute('/api/chat/kody/packages/$packageId/document')({server:{handlers:{GET:({request,params})=>handleKodyAccount(request,'package-document',params.packageId)}}})
