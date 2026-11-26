import type { ConversationEnvironment } from './conversation-environment'
import { z } from 'zod'
import { workflowStartSchema } from '../core/workflow-start'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'
import { WorkflowError } from './workflows'
import {
  workflowRunListSchema,
  workflowAnswerReadSchema,
} from '../core/workflow-inspection'
import {
  ConversationIdentityError,
  type ConversationIdentity,
} from '../conversation-identity.server'

export async function workflowRunApi(
  request: Request,
  env: Pick<ConversationEnvironment, 'CONVERSATIONS'>,
  identity: ConversationIdentity,
  id?: string,
  cancel = false,
) {
  const json = (value: unknown, status = 200) =>
    Response.json(value, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  try {
    const query = new URL(request.url).searchParams
    query.delete('workspaceId')
    const allowed =
      request.method === 'GET' && !id ? ['limit', 'afterTime', 'afterId'] : []
    if (
      [...query.keys()].some(
        (key) => !allowed.includes(key) || query.getAll(key).length !== 1,
      )
    )
      return json({ error: 'Invalid workflow run query.' }, 400)
    const stub = env.CONVERSATIONS.getByName(identity.conversationId)
    if (request.method === 'POST' && id === 'files' && !cancel) {
      const input = workflowAnswerReadSchema.parse(
        await readWorkspaceJson(request),
      )
      return json(await stub.readWorkflowFiles(identity, input))
    }
    if (request.method === 'POST' && id === 'answer' && !cancel) {
      const input = workflowAnswerReadSchema.parse(
        await readWorkspaceJson(request),
      )
      return json(await stub.readWorkflowAnswer(identity, input))
    }
    if (request.method === 'POST' && id === 'withdraw' && !cancel) {
      const input = workflowStartSchema.parse(await readWorkspaceJson(request))
      return json(await stub.withdrawWorkflowStart(identity, input))
    }
    if (request.method === 'POST' && !id) {
      const input = workflowStartSchema.parse(await readWorkspaceJson(request))
      return json(await stub.launchWorkflowRun(identity, input), 202)
    }
    if (request.method === 'POST' && id && cancel) {
      z.strictObject({}).parse(await readWorkspaceJson(request))
      return json(await stub.cancelWorkflowRun(identity, z.uuid().parse(id)))
    }
    if (request.method !== 'GET' || cancel)
      return json({ error: 'Method not allowed.' }, 405)
    const integer = (key: string) => {
      const value = query.get(key)
      if (value === null) return undefined
      if (!/^(0|[1-9][0-9]*)$/.test(value)) throw Error('Invalid integer')
      return Number(value)
    }
    if (id)
      return json(await stub.inspectWorkflowRun(identity, z.uuid().parse(id)))
    const afterTime = integer('afterTime'),
      afterId = query.get('afterId')
    const input = workflowRunListSchema.parse({
      limit: integer('limit'),
      ...(afterTime !== undefined || afterId !== null
        ? { after: { createdAt: afterTime, id: afterId } }
        : {}),
    })
    return json(await stub.listWorkflowRuns(identity, input))
  } catch (error) {
    if (error instanceof WorkspaceBodyError || error instanceof WorkflowError)
      return json({ error: error.message }, error.status)
    if (error instanceof ConversationIdentityError)
      return json({ error: error.message }, 404)
    if (
      error instanceof z.ZodError ||
      (error instanceof Error && error.message === 'Invalid integer')
    )
      return json(
        { error: 'Check the workflow run fields and try again.' },
        400,
      )
    throw error
  }
}
