import { expect, it, vi } from 'vitest'
import { selectWorkflowInput } from '../../src/chat/server/workflow-inputs'
import type { WorkflowResult } from '../../src/chat/server/workflow-results'
import { fileDeliveryFixture } from './fixtures/file-delivery'

function fixture() {
  const id = crypto.randomUUID()
  const result: WorkflowResult = {
    id,
    run: {
      id,
      identity: {
        workspaceId: 'w',
        userId: 'u',
        botId: 'b',
        conversationId: id,
      },
      origin: {
        kind: 'workflow',
        workflowRunId: crypto.randomUUID(),
        workflowId: crypto.randomUUID(),
        definitionRevision: 1,
        stepId: 'source',
        stepExecutionId: id,
        ownerConversationId: 'owner',
      },
      mode: 'assistant',
      status: 'completed',
      createdAt: 1,
      updatedAt: 2,
      completedAt: 2,
    },
    answer: { messageId: 'answer', text: 'Selected public answer' },
    files: [fileDeliveryFixture],
  }
  return {
    result,
    input: {
      name: 'selected',
      fromStep: 'source',
      executionId: id,
      resultId: id,
      output: 'answer' as const,
    },
  }
}
it('selects only the declared answer with provenance and does not read files', async () => {
  const { input, result } = fixture()
  const read = vi.fn()
  const selected = await selectWorkflowInput(input, result, read)
  expect(selected).toEqual({
    name: 'selected',
    kind: 'answer',
    source: {
      stepId: 'source',
      executionId: result.id,
      resultId: result.id,
      conversationId: result.id,
    },
    answer: result.answer,
  })
  expect(read).not.toHaveBeenCalled()
  expect(selected).not.toHaveProperty('files')
})
it('requires current file authorization and recorded content, without including the answer', async () => {
  const { input, result } = fixture()
  const fileInput = { ...input, output: 'files' as const }
  const read = vi.fn(async () => fileDeliveryFixture.file)
  const selected = await selectWorkflowInput(fileInput, result, read)
  expect(read).toHaveBeenCalledWith(fileDeliveryFixture)
  expect(selected).not.toHaveProperty('answer')
  expect(selected).toHaveProperty('files', [fileDeliveryFixture.file])
  await expect(
    selectWorkflowInput(fileInput, result, async () => {
      throw Error('Access revoked')
    }),
  ).rejects.toThrow('Access revoked')
  await expect(
    selectWorkflowInput(fileInput, result, async () => ({
      ...fileDeliveryFixture.file,
      state: 'pending',
    })),
  ).rejects.toThrow('recorded form')
  await expect(
    selectWorkflowInput(fileInput, result, async () => ({
      ...fileDeliveryFixture.file,
      sha256: 'different',
    })),
  ).rejects.toThrow('recorded form')
})
it('rejects missing answers, wrong results and unsuccessful predecessors', async () => {
  const { input, result } = fixture()
  await expect(
    selectWorkflowInput(input, { ...result, answer: undefined }, vi.fn()),
  ).rejects.toThrow('no recorded answer')
  await expect(
    selectWorkflowInput({ ...input, resultId: 'other' }, result, vi.fn()),
  ).rejects.toThrow('does not match')
  await expect(
    selectWorkflowInput(
      input,
      { ...result, run: { ...result.run, status: 'failed' } },
      vi.fn(),
    ),
  ).rejects.toThrow('does not match')
})
