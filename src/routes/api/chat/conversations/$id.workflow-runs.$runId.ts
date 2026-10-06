import {createFileRoute} from '@tanstack/react-router'
import {handleWorkflowRun} from '~/chat/server/workflow-run-http.server'
export const Route=createFileRoute('/api/chat/conversations/$id/workflow-runs/$runId')({server:{handlers:{
GET:({request,params})=>handleWorkflowRun(request,params.id,params.runId),
POST:({request,params})=>handleWorkflowRun(request,params.id,params.runId),
}}})
