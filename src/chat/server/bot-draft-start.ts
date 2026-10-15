import { BotDrafts, BotDraftError } from './bot-drafts'
import { DraftFiles } from './draft-files'
import { SavedFileError } from './saved-files'
import { validateAttachmentRequest } from './attachment-request'
import { resolveRunModel, type ModelEnvironment } from './run-models'
import {
  resolveMessageReferences,
  type ReferenceEnvironment,
} from './message-references'
import { maxMessageAttachments } from '../core/message-attachments'
import { resolveConversationIdentity } from '../conversation-identity.server'
import { readWorkspaceBot } from './bot-workspace-reads'
import type { Policy, Recipe } from '../core/types'
import type { ConversationEnvironment } from './conversation-environment'

export type DraftStartEnvironment = ModelEnvironment &
  Omit<ReferenceEnvironment, 'CONVERSATIONS'> &
  Pick<ConversationEnvironment, 'CONVERSATIONS'>
/** Original BotDrafts.start orchestration, native reservation replaces its D1 batch. */
export async function startBotDraft(
  env: DraftStartEnvironment,
  workspaceId: string,
  userId: string,
  id: string,
  input: unknown,
  context: {
    policy: Policy
    recipes: Recipe[]
    fixture: boolean
    appOrigin: string
  },
) {
  const drafts = new BotDrafts(env, workspaceId, userId)
  const receipt = await drafts.reserve(id, input, async (value) => {
    const { selection, connection } = await resolveRunModel(env, {
      ...context,
      userId: userId,
      selection: value.runModel,
    })
    const files = new DraftFiles(env, {
      workspaceId: workspaceId,
      userId: userId,
      draftId: id,
    })
    const selected = await Promise.all(
      value.fileIds.map((fileId) => files.get(fileId)),
    )
    if (selected.some((file) => file.state !== 'ready'))
      throw new SavedFileError(
        'Finish uploading each attachment before sending.',
        409,
      )
    const resolved = await resolveMessageReferences(
      env,
      { workspaceId: workspaceId, userId: userId },
      value.references,
      context,
    )
    const attachments = [...selected, ...resolved.attachments]
    if (
      attachments.length > maxMessageAttachments ||
      new Set(attachments.map((file) => file.id)).size !== attachments.length
    )
      throw new SavedFileError(
        'Choose up to five different files for this message.',
        400,
      )
    await validateAttachmentRequest(
      env,
      { ...context, userId: userId },
      attachments,
      connection,
    )
    return selection
  })
  const bot = await readWorkspaceBot(workspaceId, userId, receipt.botId)
  if (bot.archived_at !== null || bot.deleted_at !== null)
    throw new BotDraftError('Restore this conversation before continuing.', 409)
  if (receipt.started) return receipt
  if (!receipt.runModel)
    throw new BotDraftError('This draft has no saved model selection.', 409)
  const identity = await resolveConversationIdentity({
    workspaceId,
    userId,
    botId: bot.id,
    conversationId: receipt.conversationId,
  })
  const stub = env.CONVERSATIONS.getByName(identity.conversationId)
  await stub.bindIdentity(identity)
  const result = await stub.begin({
    conversationId: identity.conversationId,
    ...context,
    bot,
    userId,
    messageId: `draft:${id}`,
    text: receipt.text,
    fileIds: receipt.fileIds,
    references: receipt.references ?? [],
    runModel: receipt.runModel,
  })
  if ('ok' in result && result.ok === false)
    throw new BotDraftError(result.error, result.status)
  return drafts.markStarted(id)
}
