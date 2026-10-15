import {createFileRoute} from '@tanstack/react-router'
import {handleKodyControl} from '~/chat/server/kody-control-http.server'
export const Route=createFileRoute('/api/chat/kody/runs/$runId/triage')({server:{handlers:{POST:({request,params})=>handleKodyControl(request,'run-triage',params.runId)}}})
