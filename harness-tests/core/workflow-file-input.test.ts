import { expect, it, vi } from 'vitest'
import {
  readWorkflowFile,
  workflowFileTools,
} from '../../src/chat/server/workflow-file-input'
import { fileDeliveryFixture } from './fixtures/file-delivery'

function fixture() {
  const file = fileDeliveryFixture.file
  const selected = {
    name: 'documents',
    kind: 'files' as const,
    source: {
      stepId: 'source',
      executionId: 'execution',
      resultId: 'result',
      conversationId: 'conversation',
    },
    files: [file],
  }
  const input = { inputName: 'documents', fileId: file.id, offset: 7 }
  const load = vi.fn(async () => selected)
  const read = vi.fn(async () => ({
    file,
    text: 'selected bytes',
    offset: 7,
    nextOffset: 21,
    totalChars: 40,
  }))
  const authorize = vi.fn(async () => {})
  return { file, selected, input, load, read, authorize }
}
it('reads only selected files, preserves paging and rechecks access after reading', async () => {
  const h = fixture()
  const tool = workflowFileTools((input) =>
    readWorkflowFile(input, h.load, h.read, h.authorize),
  )[0]
  const result = await tool.execute!(h.input)
  expect(h.load).toHaveBeenCalledWith('documents')
  expect(h.read).toHaveBeenCalledWith(h.file, 7)
  expect(h.authorize.mock.invocationCallOrder[0]).toBeGreaterThan(
    h.read.mock.invocationCallOrder[0],
  )
  expect(result).toMatchObject({
    text: 'selected bytes',
    nextOffset: 21,
    source: h.selected.source,
    untrusted: true,
  })
})
it('never reads an unselected file, an answer input, or model-supplied identity', async () => {
  const h = fixture()
  await expect(
    readWorkflowFile(
      { ...h.input, fileId: crypto.randomUUID() },
      h.load,
      h.read,
      h.authorize,
    ),
  ).rejects.toThrow('file ID is not in the selected input')
  await expect(
    readWorkflowFile(
      h.input,
      async () => ({
        name: 'documents',
        kind: 'answer',
        source: h.selected.source,
        answer: { messageId: 'a', text: 'x' },
      }),
      h.read,
      h.authorize,
    ),
  ).rejects.toThrow('files input')
  await expect(
    readWorkflowFile(
      { ...h.input, userId: 'other' },
      h.load,
      h.read,
      h.authorize,
    ),
  ).rejects.toThrow()
  expect(h.read).not.toHaveBeenCalled()
})
it('withholds content after revocation during reading or a changed file receipt', async () => {
  const h = fixture()
  await expect(
    readWorkflowFile(h.input, h.load, h.read, async () => {
      throw Error('Revoked')
    }),
  ).rejects.toThrow('Revoked')
  for (const patch of [
    { sha256: 'changed' },
    { conversationId: 'other' },
    { state: 'pending' as const },
  ]) {
    await expect(
      readWorkflowFile(
        h.input,
        h.load,
        async () => ({ ...(await h.read()), file: { ...h.file, ...patch } }),
        h.authorize,
      ),
    ).rejects.toThrow('changed')
  }
})
