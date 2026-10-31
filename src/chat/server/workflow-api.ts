import { z } from 'zod'
import { Workflows, WorkflowError } from './workflows'
import { readWorkspaceJson, WorkspaceBodyError } from './workspace-request'
import type { ConversationIdentity } from '../conversation-identity.server'

/** Called only after the workspace route resolves authenticated identity. */
export async function workflowApi(
  request: Request,
  scope: ConversationIdentity,
  id?: string,
) {
  const json = (value: unknown, status = 200) =>
    Response.json(value, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  try {
    const workflows = new Workflows(scope)
    const query = new URL(request.url).searchParams
    query.delete('workspaceId')
    const allowed =
      request.method === 'GET' ? (id ? ['revision'] : ['after', 'limit']) : []
    if (
      [...query.keys()].some(
        (key) => !allowed.includes(key) || query.getAll(key).length !== 1,
      )
    )
      return json({ error: 'Invalid workflow query.' }, 400)
    const integer = (key: string) => {
      const value = query.get(key)
      if (value === null) return undefined
      if (!/^[1-9][0-9]*$/.test(value))
        throw new WorkflowError('Invalid workflow query.')
      return Number(value)
    }
    if (request.method === 'GET')
      return json(
        id
          ? await workflows.read(id, integer('revision'))
          : await workflows.list({
              after: query.get('after') ?? undefined,
              limit: integer('limit'),
            }),
      )
    if (request.method === 'POST' && !id)
      return json(await workflows.command(await readWorkspaceJson(request)))
    return json({ error: 'Method not allowed.' }, 405)
  } catch (error) {
    if (error instanceof WorkflowError || error instanceof WorkspaceBodyError)
      return json({ error: error.message }, error.status)
    if (error instanceof z.ZodError)
      return json({ error: 'Check the workflow fields and try again.' }, 400)
    throw error
  }
}
