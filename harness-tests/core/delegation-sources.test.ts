import { expect, it, vi } from 'vitest'
import { convertSchemaToJsonSchema } from '@tanstack/ai'
import {
  buildDelegationSources,
  selectDelegationSources,
  delegationSourcesSchema,
} from '../../src/chat/core/delegation-sources'
import { assistantDelegationTools } from '../../src/chat/server/assistant-delegation-tools'
import type { MessageAttachment } from '../../src/chat/core/message-attachments'

const file: MessageAttachment = {
  id: crypto.randomUUID(),
  botId: 'b',
  conversationId: 'c',
  name: 'note.txt',
  mediaType: 'text/plain',
  size: 1,
  sha256: 'a'.repeat(64),
  source: 'upload',
  state: 'ready',
  createdAt: 1,
}
const references = [
  {
    kind: 'conversation' as const,
    botId: 'b',
    conversationId: 'selected',
    label: 'Notes',
  },
  {
    kind: 'file' as const,
    botId: 'b',
    conversationId: 'c',
    fileId: file.id,
    label: file.name,
  },
  { kind: 'connection' as const, serverId: 'mcp', label: 'Connection' },
]
it('offers only selected data sources, deduplicates attachments and uses stable task selectors', () => {
  const sources = buildDelegationSources(references, [file])
  expect(sources).toHaveLength(2)
  expect(sources.map((s) => s.id)).toEqual(['source-1', 'source-2'])
  expect(selectDelegationSources(sources, ['source-2'])).toEqual([sources[1]])
  expect(() => selectDelegationSources(sources, ['source-3'])).toThrow(
    'available',
  )
  expect(() =>
    selectDelegationSources(sources, ['source-1', 'source-1']),
  ).toThrow()
  expect(selectDelegationSources(sources, undefined)).toEqual([])
  expect(
    delegationSourcesSchema.safeParse([
      { ...sources[0], reference: { kind: 'connection', serverId: 'mcp' } },
    ]).success,
  ).toBe(false)
})
it('enforces attachment limits and rejects source authority or identity supplied by a model', async () => {
  const sources = buildDelegationSources(
    [],
    Array.from({ length: 6 }, (_, i) => ({
      ...file,
      id: crypto.randomUUID(),
      name: `file-${i}.txt`,
    })),
  )
  expect(() =>
    selectDelegationSources(
      sources,
      sources.map((s) => s.id),
    ),
  ).toThrow('5 files')
  const execute = vi.fn(async () => ({}))
  const tool = assistantDelegationTools({ execute, sources })[0]
  const schema = convertSchemaToJsonSchema(tool.inputSchema!)
  expect(JSON.stringify(schema)).toContain('source-1')
  expect(JSON.stringify(schema)).toContain('untrusted names')
  const args = {
    objective: 'Read selected note',
    context: '',
    sourceIds: ['source-1'],
  }
  await tool.execute!(args, { toolCallId: 'call', emitCustomEvent: () => {} })
  expect(execute).toHaveBeenCalledWith({ type: 'delegate', ...args }, 'call')
  expect(() =>
    tool.execute!(
      { ...args, sourceIds: ['source-9'] },
      {
        toolCallId: 'bad',
        emitCustomEvent: () => {},
      },
    ),
  ).toThrow('available')
  expect(() =>
    tool.execute!(
      // @ts-expect-error Runtime schema rejects model-supplied authority fields.
      { ...args, references },
      {
        toolCallId: 'bad',
        emitCustomEvent: () => {},
      },
    ),
  ).toThrow()
})
