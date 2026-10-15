import {createFileRoute} from '@tanstack/react-router'
import {handleKodyAccount} from '~/chat/server/kody-account-http.server'
export const Route=createFileRoute('/api/chat/kody/runs')({server:{handlers:{GET:({request})=>handleKodyAccount(request,'runs')}}})
