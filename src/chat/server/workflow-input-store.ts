import { workflowInputReferences } from '../core/workflow-input-reference'
import { workflowStepAdmissionSchema } from '../core/workflow-admission'
import type { ResultStore } from './stored-results'
import type { selectWorkflowInput } from './workflow-inputs'

/** Virtual references fetch current authorized evidence on every read/search.
 * Do not persist predecessor contents into the child's ordinary result store. */
export function workflowInputStore(
  base: ResultStore,
  rawAdmission: unknown,
  load: (
    name: string,
  ) => Promise<Awaited<ReturnType<typeof selectWorkflowInput>>>,
): ResultStore {
  const admission = workflowStepAdmissionSchema.parse(rawAdmission)
  const references = new Map(
    workflowInputReferences(admission).map((ref) => [ref.resultId, ref]),
  )
  return {
    async get(id) {
      const reference = references.get(id)
      if (!reference) return base.get(id)
      const value = await load(reference.name)
      if (
        value.name !== reference.name ||
        value.kind !== reference.kind ||
        value.source.stepId !== reference.source.stepId ||
        value.source.executionId !== reference.source.executionId ||
        value.source.resultId !== reference.source.resultId
      )
        throw Error('Workflow input does not match its reference.')
      return value.kind === 'files'
        ? {
            ...value,
            files: value.files.map((file) => ({
              ...file,
              read: {
                tool: 'read_workflow_file',
                arguments: {
                  inputName: value.name,
                  fileId: file.id,
                  offset: 0,
                },
              },
            })),
          }
        : value
    },
    async put(id, value) {
      if (references.has(id))
        throw Error('Workflow input references are read-only.')
      return base.put(id, value)
    },
  }
}
