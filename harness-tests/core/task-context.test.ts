import { describe, expect, it } from 'vitest'
import type { UIMessage } from '@tanstack/ai'
import { taskContext } from '../../src/chat/core/task-context'
import { newAssistantTask } from '../../src/chat/core/assistant-task'
import { buildDelegationSources } from '../../src/chat/core/delegation-sources'
import type { MessageAttachment } from '../../src/chat/core/message-attachments'
import type { MessageReference } from '../../src/chat/core/message-references'

const file: MessageAttachment = {
  id: crypto.randomUUID(),
  botId: 'source-bot',
  conversationId: 'source-room',
  name: 'Notes.txt',
  mediaType: 'text/plain',
  size: 12,
  sha256: 'a'.repeat(64),
  source: 'upload',
  state: 'ready',
  createdAt: 1,
}
const references: MessageReference[] = [
  {
    kind: 'file',
    botId: file.botId,
    conversationId: file.conversationId,
    fileId: file.id,
    label: file.name,
  },
  {
    kind: 'conversation',
    botId: 'other',
    conversationId: 'other-room',
    label: 'Planning',
  },
  {
    kind: 'tool',
    serverId: 'generic-server',
    toolName: 'read_notes',
    label: 'Read notes',
  },
  {
    kind: 'skill',
    skillId: crypto.randomUUID(),
    version: 2,
    label: 'Brief summary',
  },
  { kind: 'connection', serverId: 'generic-server', label: 'Notes connection' },
  {
    kind: 'plugin',
    installationId: crypto.randomUUID(),
    version: 1,
    label: 'Review package',
    detail: 'Installed v1',
  },
]
const source: UIMessage = {
  id: 'original',
  role: 'user',
  parts: [{ type: 'text', content: 'Summarize my notes.' }],
  metadata: { gumReferences: references, gumAttachments: [file] },
}
const continuation: UIMessage = {
  id: 'continuation',
  role: 'user',
  parts: [{ type: 'text', content: 'Continue after approval.' }],
  metadata: {
    gumReferences: [
      { kind: 'conversation', botId: 'unrelated', label: 'Unrelated source' },
    ],
  },
}
const task = {
  ...newAssistantTask('Summarize my notes.', 'original'),
  delegationSources: buildDelegationSources(references, [file]),
}

describe('task context evidence', () => {
  it('uses the task request instead of a later continuation and lists selected files only once', () => {
    const result = taskContext([source, continuation], task)
    expect(result.message).toBe(source)
    expect(result.sources).toEqual(references)
    expect(result.sources.filter((item) => item.kind === 'file')).toHaveLength(
      1,
    )
    expect(JSON.stringify(result.sources)).not.toContain('Unrelated source')
  })
  it('keeps frozen file and conversation scope after the original message is archived', () => {
    const result = taskContext([continuation], task)
    expect(result.message).toBeUndefined()
    expect(result.sources).toEqual(references.slice(0, 2))
    expect(result.sources[0]).toMatchObject({
      botId: 'source-bot',
      conversationId: 'source-room',
      fileId: file.id,
    })
  })
  it('preserves every selected kind after archival without borrowing continuation inputs', () => {
    const frozenTask = { ...task, selectedReferences: references }
    const result = taskContext([continuation], frozenTask)
    expect(result.sources).toEqual(references)
    expect(result.message).toBeUndefined()
    expect(frozenTask.delegationSources).toHaveLength(2)
  })
  it('bounds snapshots and strips unknown payload fields', () => {
    const selectedReferences = references.map((reference) => ({
      ...reference,
      token: 'secret',
      content: 'not display metadata',
    }))
    expect(taskContext([], { ...task, selectedReferences }).sources).toEqual(
      references,
    )
    expect(
      taskContext([], {
        ...newAssistantTask('Earlier', 'archived'),
        selectedReferences: Array(11).fill(references[0]),
      }).sources,
    ).toEqual([])
  })
  it('does not invent context for a legacy task or borrow another request when its source is absent', () => {
    expect(
      taskContext([continuation], newAssistantTask('Earlier task', 'archived'))
        .sources,
    ).toEqual([])
    const malformed: typeof task = {
      ...task,
      delegationSources: [
        {
          ...task.delegationSources[0],
          reference: { kind: 'file', botId: '../other', fileId: file.id },
        },
      ],
    }
    expect(taskContext([], malformed).sources).toEqual([])
  })
  it('shows the latest request selections for a conversation without an assistant task', () => {
    const result = taskContext([source, continuation])
    expect(result.message).toBe(continuation)
    expect(result.sources).toEqual([
      { kind: 'conversation', botId: 'unrelated', label: 'Unrelated source' },
    ])
  })
  it('does not expose attachment storage or inline payloads in the source projection', () => {
    const message = {
      ...source,
      metadata: {
        gumAttachments: [
          {
            ...file,
            token: 'secret',
            url: 'https://invalid.example',
            content: 'private contents',
          },
        ],
      },
    }
    const result = taskContext([message], task)
    const output = JSON.stringify(result)
    // Only the sources are rendered; the request message is used for text and its link.
    const sources = JSON.stringify(result.sources)
    for (const value of [
      'secret',
      'invalid.example',
      'private contents',
      file.sha256,
    ])
      expect(sources).not.toContain(value)
    expect(output).toContain('Notes.txt')
  })
})
