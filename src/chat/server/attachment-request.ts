import type { SavedFile } from '../core/files'
import type { Connection, Policy } from '../core/types'
import { enforceModel } from '../core/routing'
import type { RunModelSelection } from '../core/run-model'
import { resolveRunModel, type ModelEnvironment } from './run-models'
import {
  ModelAttachmentError,
  validateModelAttachments,
} from './model-attachments'

/** Check the current execution policy before accepting any attached content. */
export async function validateAttachmentRequest(
  env: ModelEnvironment,
  input: {
    runModel?: RunModelSelection
    userId: string
    policy: Policy
    fixture: boolean
    systemOne?: boolean
    proposeToolsOnly?: boolean
  },
  files: ReadonlyArray<Pick<SavedFile, 'name' | 'mediaType' | 'size'>>,
  selectedConnection?: Connection,
) {
  if (!files.length) return
  if (
    input.systemOne ||
    input.proposeToolsOnly ||
    !input.policy.allowChatModels
  )
    throw new ModelAttachmentError(
      'Attachments need Assistant mode and a model allowed by your workspace.',
      422,
    )
  const connection =
    selectedConnection ??
    (
      await resolveRunModel(env, {
        userId: input.userId,
        policy: input.policy,
        fixture: input.fixture,
        selection: input.runModel,
      })
    ).connection
  const model =
    connection.model ||
    (connection.provider === 'included' ? env.INCLUDED_MODEL : '')
  enforceModel(input.policy, connection.provider, model)
  validateModelAttachments(files, {
    connection,
    includedModel: env.INCLUDED_MODEL,
  })
}
