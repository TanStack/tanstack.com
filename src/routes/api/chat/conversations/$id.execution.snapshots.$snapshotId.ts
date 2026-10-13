import {createFileRoute} from '@tanstack/react-router'
import {handleConversationExecution} from '~/chat/server/conversation-execution-http.server'
export const Route=createFileRoute('/api/chat/conversations/$id/execution/snapshots/$snapshotId')({server:{handlers:{
 GET:({request,params})=>handleConversationExecution(request,params.id,params.snapshotId),
 PUT:({request,params})=>handleConversationExecution(request,params.id,params.snapshotId),
}}})
