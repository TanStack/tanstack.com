import { z } from 'zod'
import { queueCommandSchema } from '../core/conversation-queue'
import { readWorkspaceJson } from './workspace-request'
import type { Conversation, RunInput } from './conversation'
type ControlContext = Pick<
  RunInput,
  | 'conversationId'
  | 'userId'
  | 'bot'
  | 'policy'
  | 'recipes'
  | 'fixture'
  | 'appOrigin'
>
/** Source control handling, caller authorizes ownership before passing the stub. */
export async function conversationControlApi(
  request: Request,
  operation: string,
  stub: Pick<
    Conversation,
    | 'stop'
    | 'updateQueue'
    | 'reset'
    | 'dismissPendingTask'
    | 'continueTask'
    | 'decideApproval'
  >,
  bot: { deleted_at: number | null; archived_at: number | null },
  loadContext: () => Promise<ControlContext>,
): Promise<Response | undefined> {
  const body = () => readWorkspaceJson(request)
  const json = (value: unknown, status = 200) =>
    Response.json(value, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  if (operation === 'stop') return json(await stub.stop())
  if (operation === 'queue') {
    const command = queueCommandSchema.parse(await body())
    if (
      (bot.deleted_at !== null || bot.archived_at !== null) &&
      ['resume', 'run-next'].includes(command.type)
    )
      return json(
        {
          error:
            'Restore or unarchive this conversation before running queued messages.',
        },
        409,
      )
    const result = await stub.updateQueue(command)
    return json(result, result.ok ? 200 : result.status)
  }
  if (bot.deleted_at !== null || bot.archived_at !== null)
    return json(
      {
        error:
          'Restore or unarchive this conversation before starting or changing its work.',
      },
      409,
    )
  if (operation === 'reset') {
    await stub.reset()
    return json({ ok: true })
  }
  if (operation === 'dismiss-task') {
    const command = z
      .strictObject({ id: z.string().uuid() })
      .parse(await body())
    return json(await stub.dismissPendingTask(command.id))
  }
  if (!['continue-task', 'approval'].includes(operation)) return undefined
  const context = await loadContext()
  if (operation === 'continue-task') {
    const b = z
      .object({
        id: z.string().uuid(),
      })
      .parse(await body())
    return json(await stub.continueTask(b.id, context))
  }
  if (operation === 'approval') {
    const b = z
      .object({ id: z.string(), approve: z.boolean() })
      .parse(await body())
    return json(await stub.decideApproval(b.id, b.approve, context))
  }
}
