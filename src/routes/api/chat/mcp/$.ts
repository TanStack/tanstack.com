import { hasChatAccess } from '~/chat/access.server'
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { getAuthService } from '~/auth/index.server'
import { jsonError, validateSameOriginRequest } from '~/utils/api-boundary.server'
import { readWorkspacePolicy, WorkspacePolicyError } from '~/chat/workspace-policy.server'
import { getMcpEnvironment, McpEnvironmentError } from '~/chat/server/mcp-environment.server'
import { mcpAccountApi } from '~/chat/server/mcp-account-api'
import { McpAccountError } from '~/chat/server/mcp-account-contract'
import { McpAuthorizationError } from '~/chat/server/mcp-auth-network'
export async function handleMcp(request: Request) {
 if(request.method==='POST') {
  const error=validateSameOriginRequest(request)
  if(error) return jsonError(error.message,error.status)
 }
 const user=await getAuthService().getCurrentUser(request)
 if(!user) return jsonError('Sign in to continue.',401)
 if(!await hasChatAccess(user)) return jsonError('Chat access is unavailable.',403)
 const url=new URL(request.url)
 const workspace=z.string().min(1).max(1000).safeParse(url.searchParams.get('workspaceId'))
 if(!workspace.success) return jsonError('Choose a workspace.',400)
 try {
  await readWorkspacePolicy(workspace.data,user.userId)
  const path=url.pathname.slice('/api/chat/'.length)
  return await mcpAccountApi(request,await getMcpEnvironment(),{workspaceId:workspace.data,userId:user.userId},path)??jsonError('Not found.',404)
 } catch(error) {
  if(error instanceof WorkspacePolicyError||error instanceof McpEnvironmentError||error instanceof McpAccountError||error instanceof McpAuthorizationError) return jsonError(error.message,error.status)
  if(error instanceof z.ZodError) return jsonError('The connection request is invalid.',400)
  throw error
 }
}
export const Route=createFileRoute('/api/chat/mcp/$')({server:{handlers:{GET:({request})=>handleMcp(request),POST:({request})=>handleMcp(request)}}})
