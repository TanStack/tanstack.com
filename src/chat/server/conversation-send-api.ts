import { z } from 'zod'
import { messageAttachmentIdsSchema } from '../core/message-attachments'
import { runModelSchema } from '../core/run-model'
import { referenceInputsSchema } from '../core/message-references'
import { retrySendBindingSchema } from '../core/send-receipt'
import { readWorkspaceJson } from './workspace-request'
import type { RunInput, Conversation } from './conversation'

/** Source submission validation. The caller supplies authorized, server-derived context. */
export async function conversationSendApi(
  request: Request,
  stub: Pick<Conversation, 'begin'>,
  context: Pick<
    RunInput,
    | 'conversationId'
    | 'userId'
    | 'bot'
    | 'policy'
    | 'recipes'
    | 'fixture'
    | 'appOrigin'
  >,
): Promise<Response> {
  const body = () => readWorkspaceJson(request)
  const json = (value: unknown, status: number) =>
    Response.json(value, {
      status,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  const b = z
    .object({
      text: z.string().trim().max(12000),
      fileIds: messageAttachmentIdsSchema.default([]),
      runModel: runModelSchema.optional(),
      references: referenceInputsSchema.default([]),
      retry: retrySendBindingSchema.optional(),
      messageId: z.string().min(1).max(128),
      proposeToolsOnly: z.boolean().default(false),
      systemOne: z.boolean().default(false),
      refreshCatalog: z.boolean().default(false),
      delivery: z.enum(['queue', 'interrupt']).default('queue'),
    })
    .parse(await body())
  const result = await stub.begin({ ...context, ...b })
  return json(
    result,
    'ok' in result && result.ok === false ? result.status : 200,
  )
}
