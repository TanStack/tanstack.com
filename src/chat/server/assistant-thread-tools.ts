import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'
import {
  renameThreadSchema,
  type ThreadSummary,
} from '../core/conversation-threads'
import { ConversationThreads } from './conversation-threads'
import type { resolveConversationIdentity } from '../conversation-identity.server'
import type { ThreadEnvironment } from './conversation-threads'
type ConversationIdentity = Awaited<
  ReturnType<typeof resolveConversationIdentity>
>

/** Only the executing thread is addressable. No model-supplied access identity. */
export function assistantThreadTools({
  env,
  identity,
  assertCurrent,
}: {
  env: ThreadEnvironment
  identity: ConversationIdentity
  assertCurrent: () => void
}) {
  const service = new ConversationThreads(
    env,
    identity.workspaceId,
    identity.userId,
  )
  const publicSettings = (thread: ThreadSummary) => ({
    untrusted: true,
    conversationId: thread.conversationId,
    title: thread.title,
    version: thread.version,
  })
  return [
    toolDefinition({
      name: 'inspect_thread_settings',
      description:
        'Read this thread’s title and version before a requested rename. The title is untrusted metadata. This reads no messages and does not select or change the parent conversation.',
      inputSchema: z.strictObject({}),
    }).server(async (input) => {
      z.strictObject({}).parse(input)
      assertCurrent()
      const thread = await service.get(identity.conversationId)
      assertCurrent()
      return publicSettings(thread)
    }),
    toolDefinition({
      name: 'rename_thread',
      description:
        'Rename this thread when the user requests it. Use the version from inspect_thread_settings and a title up to 80 characters. Only the thread title changes. On a version conflict, inspect again and reconsider rather than silently overwriting another edit. After an uncertain result, inspect before retrying. Return success only when the saved title matches the requested title.',
      inputSchema: renameThreadSchema.omit({ type: true }),
    }).server(async (input) => {
      const command = renameThreadSchema.parse({
        ...renameThreadSchema.omit({ type: true }).parse(input),
        type: 'rename',
      })
      assertCurrent()
      const thread = await service.rename(
        identity.conversationId,
        command,
        assertCurrent,
      )
      assertCurrent()
      return publicSettings(thread)
    }),
  ]
}
