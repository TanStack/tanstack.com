import type { FileEnvironment } from './saved-files'
import type { FileScope } from '../core/files'
import {
  messageAttachmentSchema,
  parseAttachmentFileIds,
  type MessageAttachment,
} from '../core/message-attachments'
import { SavedFileError, SavedFiles } from './saved-files'

/** Resolve only server-owned file identities; caller-supplied metadata is never used. */
export async function resolveMessageAttachments(
  env: FileEnvironment,
  scope: FileScope,
  fileIds: unknown,
): Promise<MessageAttachment[]> {
  const ids = parseAttachmentFileIds(fileIds)
  const files = new SavedFiles(env, { ...scope })
  return Promise.all(
    ids.map(async (id) => {
      const file = await files.get(id)
      if (file.state !== 'ready')
        throw new SavedFileError(
          'Finish uploading each attachment before sending.',
          409,
        )
      const parsed = messageAttachmentSchema.safeParse(file)
      if (
        !parsed.success ||
        parsed.data.id !== id ||
        parsed.data.botId !== scope.botId ||
        (scope.conversationId !== undefined &&
          parsed.data.conversationId !== scope.conversationId)
      )
        throw new SavedFileError(
          'The attachment metadata could not be verified.',
          503,
        )
      return parsed.data
    }),
  )
}
