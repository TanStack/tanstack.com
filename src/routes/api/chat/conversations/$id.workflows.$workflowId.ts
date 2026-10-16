import {createFileRoute} from '@tanstack/react-router'
import {handleWorkflow} from '~/chat/server/workflow-http.server'
export const Route=createFileRoute('/api/chat/conversations/$id/workflows/$workflowId')({server:{handlers:{GET:({request,params})=>handleWorkflow(request,params.id,params.workflowId)}}})
