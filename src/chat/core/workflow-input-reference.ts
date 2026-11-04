import type { WorkflowStepAdmission } from './workflow-admission'

export function workflowInputReferences(admission: WorkflowStepAdmission) {
  return admission.inputs.map((input, index) => ({
    name: input.name,
    kind: input.output,
    resultId: `result_${admission.id}-${index.toString(16)}`,
    path: input.output === 'answer' ? '/answer/text' : '/files',
    source: {
      stepId: input.fromStep,
      executionId: input.executionId,
      resultId: input.resultId,
    },
  }))
}
export type WorkflowInputReference = ReturnType<
  typeof workflowInputReferences
>[number]
