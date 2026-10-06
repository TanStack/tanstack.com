import type { WorkflowStepInput } from '../core/workflow-runs'
import type { SavedFile } from '../core/files'
import type { FileDelivery } from '../core/file-deliveries'
import type { WorkflowResult } from './workflow-results'

/** Selects public evidence, never instructions or access grants. The caller
 * verifies the source admission and performs current file authorization. */
export async function selectWorkflowInput(
  input: WorkflowStepInput,
  result: WorkflowResult,
  readFile: (delivery: FileDelivery) => Promise<SavedFile>,
) {
  if (
    result.id !== input.resultId ||
    result.run.id !== input.executionId ||
    result.run.origin.kind !== 'workflow' ||
    result.run.origin.stepId !== input.fromStep ||
    result.run.status !== 'completed'
  )
    throw Error('Workflow input does not match a completed predecessor.')
  const source = {
    stepId: input.fromStep,
    executionId: input.executionId,
    resultId: input.resultId,
    conversationId: result.run.identity.conversationId,
  }
  if (input.output === 'answer') {
    if (!result.answer) throw Error('The predecessor has no recorded answer.')
    return {
      name: input.name,
      kind: 'answer' as const,
      source,
      answer: result.answer,
    }
  }
  const files: SavedFile[] = []
  for (const delivery of result.files) {
    const file = await readFile(delivery)
    if (
      file.state !== 'ready' ||
      file.id !== delivery.file.id ||
      file.sha256 !== delivery.file.sha256
    )
      throw Error(
        'A predecessor file is no longer available in its recorded form.',
      )
    files.push(file)
  }
  return { name: input.name, kind: 'files' as const, source, files }
}
