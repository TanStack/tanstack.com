import { hasChatAccess } from '~/chat/access.server'
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { getAuthService } from '~/auth/index.server'
import { jsonError,validateSameOriginRequest } from '~/utils/api-boundary.server'
import { readWorkspacePolicy,WorkspacePolicyError } from '~/chat/workspace-policy.server'
import { getKodyEnvironment,KodyEnvironmentError } from '~/chat/server/kody-environment.server'
import { skillApi } from '~/chat/server/skill-api'
export async function handleSkills(request:Request, id?:string) {
 if(request.method==='POST') {
  const error=validateSameOriginRequest(request)
  if(error) return jsonError(error.message,error.status)
 }
 const user=await getAuthService().getCurrentUser(request)
 if(!user) return jsonError('Sign in to continue.',401)
 if(!await hasChatAccess(user)) return jsonError('Chat access is unavailable.',403)
 const url=new URL(request.url)
 const parsed=z.string().min(1).max(1000).safeParse(url.searchParams.get('workspaceId'))
 if(url.searchParams.getAll('workspaceId').length!==1||!parsed.success) return jsonError('Choose a workspace.',400)
 try {
  await readWorkspacePolicy(parsed.data,user.userId)
  return await skillApi(request,await getKodyEnvironment(),{workspaceId:parsed.data,userId:user.userId},id??url.searchParams.get('id')??undefined)
 } catch(error) {
  if(error instanceof WorkspacePolicyError||error instanceof KodyEnvironmentError) return jsonError(error.message,error.status)
  throw error
 }
}
export const Route=createFileRoute('/api/chat/skills')({server:{handlers:{GET:({request})=>handleSkills(request),POST:({request})=>handleSkills(request)}}})
