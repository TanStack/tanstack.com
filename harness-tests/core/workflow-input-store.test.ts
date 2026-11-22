import { fileDeliveryFixture } from './fixtures/file-delivery'
import { expect, it, vi } from 'vitest'
import { workflowInputReferences } from '../../src/chat/core/workflow-input-reference'
import type { WorkflowStepAdmission } from '../../src/chat/core/workflow-admission'
import { workflowInputStore } from '../../src/chat/server/workflow-input-store'
import { StoredResults } from '../../src/chat/server/stored-results'
import { buildAssistantInstructions } from '../../src/chat/server/assistant-instructions'
import { newAssistantTask } from '../../src/chat/core/assistant-task'
function fixture() {
  const id = crypto.randomUUID(),
    predecessor = crypto.randomUUID()
  const admission: WorkflowStepAdmission = {
    id,
    workflowRunId: crypto.randomUUID(),
    workflowId: crypto.randomUUID(),
    definitionRevision: 1,
    stepId: 'join',
    owner: {
      workspaceId: 'w',
      userId: 'u',
      botId: 'b',
      conversationId: 'owner',
    },
    childConversationId: id,
    objective: 'Review',
    model: { provider: 'included', model: 'test' },
    sources: [],
    createdAt: 1,
    deadline: 1000,
    inputs: [
      {
        name: 'report',
        output: 'answer',
        fromStep: 'research',
        executionId: predecessor,
        resultId: predecessor,
      },
    ],
  }
  const text = 'Full public answer 🌲 '.repeat(1200)
  const selected = {
    name: 'report',
    kind: 'answer' as const,
    source: {
      stepId: 'research',
      executionId: predecessor,
      resultId: predecessor,
      conversationId: predecessor,
    },
    answer: { messageId: 'answer', text },
  }
  const saved = new Map<string, unknown>()
  const base = {
    put: vi.fn(async (id: string, value: unknown) => {
      saved.set(id, value)
    }),
    get: vi.fn(async (id: string) => saved.get(id)),
  }
  const load = vi.fn(async () => selected)
  return {
    admission,
    text,
    selected,
    saved,
    base,
    load,
    reference: workflowInputReferences(admission)[0],
  }
}
it('pages the complete answer with fresh authorized loads and no durable duplicate', async () => {
  const h = fixture()
  const reader = new StoredResults(
    workflowInputStore(h.base, h.admission, h.load),
  )
  let offset: number | null = 0,
    text = ''
  while (offset !== null) {
    const page = await reader.read(
      h.reference.resultId,
      h.reference.path,
      offset,
    )
    expect(page.text.length).toBeLessThanOrEqual(6000)
    text += page.text
    offset = page.nextOffset
  }
  expect(text).toBe(h.text)
  expect(h.load.mock.calls.length).toBeGreaterThan(1)
  expect(h.saved.size).toBe(0)
  h.load.mockRejectedValueOnce(Error('Access revoked'))
  await expect(
    reader.search(h.reference.resultId, 'public', h.reference.path),
  ).rejects.toThrow('Access revoked')
})
it('keeps references stable across reconstruction and refuses overwrite or mismatched evidence', async () => {
  const h = fixture()
  expect(
    workflowInputReferences(JSON.parse(JSON.stringify(h.admission))),
  ).toEqual([h.reference])
  const store = workflowInputStore(h.base, h.admission, h.load)
  await expect(store.put(h.reference.resultId, 'replacement')).rejects.toThrow(
    'read-only',
  )
  await store.put('result_ordinary', { value: 1 })
  expect(await store.get('result_ordinary')).toEqual({ value: 1 })
  h.load.mockResolvedValueOnce({ ...h.selected, name: 'unselected' })
  await expect(store.get(h.reference.resultId)).rejects.toThrow(
    'does not match',
  )
})
it('includes bounded references in instruction manifests without inlining predecessor answers', () => {
  const h = fixture()
  const bot = {
    id: 'b',
    workspace_id: 'w',
    parent_id: null,
    name: 'Test',
    purpose: '',
    created_at: 1,
  }
  const result = buildAssistantInstructions(
    bot,
    newAssistantTask('Review', 'request'),
    {},
    { enabledTools: ['read_stored_result'], workflowInputs: [h.reference] },
  )
  expect(
    result.manifest.sections.some(
      (section) => section.id === 'context.workflow-inputs',
    ),
  ).toBe(true)
  expect(result.systemPrompts.join('\n')).toContain(h.reference.resultId)
  expect(result.systemPrompts.join('\n')).not.toContain(h.text)
  // Provenance IDs remain in host validation, not as competing read handles.
  expect(result.systemPrompts.join('\n')).not.toContain(
    h.reference.source.resultId,
  )
  const instruction = result.systemPrompts.find((text) =>
    text.includes('explicitly selected predecessor outputs'),
  )!
  const data = JSON.parse(
    instruction.split('<gum-data-json>')[1].split('</gum-data-json>')[0],
  ).data
  expect(data).toEqual([
    {
      name: 'report',
      kind: 'answer',
      fromStep: 'research',
      read: {
        tool: 'read_stored_result',
        arguments: { resultId: h.reference.resultId, path: '/answer/text' },
      },
    },
  ])
  expect(
    result.manifest.sections.find(
      (section) => section.id === 'context.workflow-inputs',
    )?.version,
  ).toBe('2')
  const unavailable = buildAssistantInstructions(
    bot,
    newAssistantTask('Review', 'request'),
    {},
    { enabledTools: [], workflowInputs: [h.reference] },
  )
  expect(
    unavailable.manifest.sections.some(
      (section) => section.id === 'context.workflow-inputs',
    ),
  ).toBe(false)
})

it('supplies exact predecessor file-reading arguments with discovered metadata', async () => {
  const h = fixture()
  h.admission.inputs[0].output = 'files'
  const selected = {
    name: 'report',
    kind: 'files' as const,
    source: h.selected.source,
    files: [fileDeliveryFixture.file],
  }
  const store = workflowInputStore(h.base, h.admission, async () => selected)
  const ref = workflowInputReferences(h.admission)[0]
  expect(await store.get(ref.resultId)).toMatchObject({
    files: [
      {
        id: fileDeliveryFixture.file.id,
        read: {
          tool: 'read_workflow_file',
          arguments: {
            inputName: 'report',
            fileId: fileDeliveryFixture.file.id,
            offset: 0,
          },
        },
      },
    ],
  })
  expect(selected.files[0]).not.toHaveProperty('read')
  expect(h.base.put).not.toHaveBeenCalled()
})
