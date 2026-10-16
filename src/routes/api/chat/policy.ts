import {createFileRoute} from '@tanstack/react-router'
import {handleWorkspacePolicy} from '~/chat/server/workspace-policy-http.server'
export const Route=createFileRoute('/api/chat/policy')({server:{handlers:{POST:({request})=>handleWorkspacePolicy(request)}}})
