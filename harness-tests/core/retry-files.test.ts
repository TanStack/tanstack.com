import { describe, expect, it, vi } from 'vitest'
import type { MessageAttachment } from '../../src/chat/core/message-attachments'
import type { MessageReference } from '../../src/chat/core/message-references'
import type { RetryRequest } from '../../src/chat/core/retry-request'
import {
  createRetryFilePlan,
  RetryFilePlanError,
} from '../../src/chat/core/retry-files'

const uuid = (n: number) =>
  `abcdef00-1234-4567-89ab-${String(n).padStart(12, '0')}`
const file = (n: number, owner = 'source'): MessageAttachment => ({
  id: uuid(n),
  botId: owner,
  conversationId: `${owner}-conversation`,
  name: `file-${n}.txt`,
  mediaType: 'text/plain',
  size: n,
  sha256: 'a'.repeat(64),
  source: 'upload',
  state: 'ready',
  createdAt: 100,
})
const fileReference = (source: MessageAttachment): MessageReference => ({
  kind: 'file',
  fileId: source.id,
  botId: source.botId,
  ...(source.conversationId ? { conversationId: source.conversationId } : {}),
  label: source.name,
})
const request = (
  attachments: MessageAttachment[] = [],
  references: MessageReference[] = [],
): RetryRequest => ({
  text: 'Use the original inputs',
  attachments,
  references,
})

describe('retry file handoff planning', () => {
  it('imports direct files and retains explicit source references without duplicating them', () => {
    const direct = file(1)
    const selected = file(2, 'other')
    const refs: MessageReference[] = [
      { kind: 'connection', serverId: 'mcp:records', label: 'Records' },
      fileReference(selected),
      {
        kind: 'skill',
        skillId: uuid(3),
        version: 7,
        label: 'Review',
      },
    ]
    const source = request([direct, selected], refs)
    const allocate = vi.fn(() => uuid(10))
    const plan = createRetryFilePlan(source, allocate)

    expect(plan).toEqual({
      version: 1,
      references: refs,
      imports: [{ source: direct, targetFileId: uuid(10) }],
    })
    expect(allocate).toHaveBeenCalledTimes(1)
    expect(plan.imports[0].source).not.toBe(direct)
    expect(plan.references[1]).not.toBe(refs[1])
    plan.imports[0].source.name = 'Changed only in plan'
    plan.references[1].label = 'Changed only in plan'
    expect(source.attachments[0].name).toBe('file-1.txt')
    expect(source.references[1].label).toBe('file-2.txt')
  })

  it('preserves file order and allocates each stable target identity only once', () => {
    const attachments = [file(2), file(1)]
    const allocate = vi
      .fn()
      .mockReturnValueOnce(uuid(20).toUpperCase())
      .mockReturnValueOnce(uuid(21))
    const plan = createRetryFilePlan(request(attachments), allocate)
    const persisted = JSON.parse(JSON.stringify(plan))

    expect(persisted.imports).toEqual([
      { source: attachments[0], targetFileId: uuid(20) },
      { source: attachments[1], targetFileId: uuid(21) },
    ])
    expect(allocate).toHaveBeenCalledTimes(2)
    expect(persisted).toEqual(plan)
  })

  it('requires no allocation for referenced files or a request without files', () => {
    const allocate = vi.fn(() => uuid(10))
    const selected = file(1)
    expect(
      createRetryFilePlan(
        request([selected], [fileReference(selected)]),
        allocate,
      ),
    ).toEqual({
      version: 1,
      references: [fileReference(selected)],
      imports: [],
    })
    expect(createRetryFilePlan(request(), allocate)).toEqual({
      version: 1,
      references: [],
      imports: [],
    })
    expect(allocate).not.toHaveBeenCalled()
  })

  it('does not turn five direct files and ten non-file references into excess references', () => {
    const attachments = Array.from({ length: 5 }, (_, n) => file(n + 1))
    const references: MessageReference[] = Array.from(
      { length: 10 },
      (_, n) => ({
        kind: 'connection',
        serverId: `server-${n}`,
        label: `Server ${n}`,
      }),
    )
    let next = 20
    const plan = createRetryFilePlan(request(attachments, references), () =>
      uuid(next++),
    )
    expect(plan.references).toEqual(references)
    expect(plan.imports).toHaveLength(5)
  })

  it('fails before allocating IDs when an explicit reference has no attachment snapshot', () => {
    const allocate = vi.fn(() => uuid(10))
    expect(() =>
      createRetryFilePlan(
        request([file(1)], [fileReference(file(2))]),
        allocate,
      ),
    ).toThrow(/missing its original snapshot/)
    expect(allocate).not.toHaveBeenCalled()
  })

  it.each([
    { botId: 'different-bot' },
    { conversationId: 'different-conversation' },
    { conversationId: undefined },
  ])(
    'rejects the same file ID under a different or incomplete reference owner: %j',
    (change) => {
      const attachment = file(1)
      const allocate = vi.fn(() => uuid(10))
      const reference = {
        ...fileReference(attachment),
        ...change,
      } as MessageReference
      expect(() =>
        createRetryFilePlan(request([attachment], [reference]), allocate),
      ).toThrow(/does not match its original conversation/)
      expect(allocate).not.toHaveBeenCalled()
    },
  )

  it('does not guess a legacy snapshot into an exact referenced conversation', () => {
    const exact = file(1)
    const legacy = { ...exact, conversationId: undefined }
    const allocate = vi.fn(() => uuid(10))
    expect(() =>
      createRetryFilePlan(request([legacy], [fileReference(exact)]), allocate),
    ).toThrow(RetryFilePlanError)
    expect(allocate).not.toHaveBeenCalled()
  })

  it('retains matching legacy identities without assigning them a conversation', () => {
    const legacy = { ...file(1), conversationId: undefined }
    const allocate = vi.fn(() => uuid(10))
    const plan = createRetryFilePlan(
      request([legacy], [fileReference(legacy)]),
      allocate,
    )
    expect(plan.references).toEqual([fileReference(legacy)])
    expect(plan.imports).toEqual([])
    expect(plan.references[0]).not.toHaveProperty('conversationId')
    expect(allocate).not.toHaveBeenCalled()
  })

  it('rejects duplicate snapshots and references without silently deduplicating', () => {
    const attachment = file(1)
    const reference = fileReference(attachment)
    const allocate = vi.fn(() => uuid(10))
    for (const source of [
      request([attachment, attachment]),
      request([attachment], [reference, reference]),
    ])
      expect(() => createRetryFilePlan(source, allocate)).toThrow(
        RetryFilePlanError,
      )
    expect(allocate).not.toHaveBeenCalled()
  })

  it('rejects file and reference limits before allocating target identities', () => {
    const allocate = vi.fn(() => uuid(20))
    expect(() =>
      createRetryFilePlan(
        request(Array.from({ length: 6 }, (_, n) => file(n + 1))),
        allocate,
      ),
    ).toThrow(RetryFilePlanError)
    const references: MessageReference[] = Array.from(
      { length: 11 },
      (_, n) => ({
        kind: 'connection',
        serverId: `server-${n}`,
        label: 'Server',
      }),
    )
    expect(() =>
      createRetryFilePlan(request([file(1)], references), allocate),
    ).toThrow(RetryFilePlanError)
    expect(allocate).not.toHaveBeenCalled()
  })

  it('rejects target IDs that alias any source or another target', () => {
    for (const createId of [
      () => uuid(1),
      () => uuid(2).toUpperCase(),
      () => uuid(20),
    ]) {
      expect(() =>
        createRetryFilePlan(request([file(1), file(2)]), createId),
      ).toThrow(/identities could not be allocated safely/)
    }
    expect(() =>
      createRetryFilePlan(
        request([file(1), file(2)], [fileReference(file(2))]),
        () => uuid(2),
      ),
    ).toThrow(RetryFilePlanError)
  })

  it.each(['not-a-uuid', '', 'https://example.test/file', '../../file'])(
    'rejects an invalid target identity: %s',
    (id) => {
      expect(() => createRetryFilePlan(request([file(1)]), () => id)).toThrow(
        RetryFilePlanError,
      )
    },
  )

  it('preserves hashes and source provenance without trusting extra payload fields', () => {
    const attachment = {
      ...file(1),
      source: 'assistant' as const,
      url: 'https://example.test/private',
      bytes: 'private',
    }
    const plan = createRetryFilePlan(request([attachment]), () => uuid(10))
    expect(plan.imports[0].source).toEqual({ ...file(1), source: 'assistant' })
    expect(JSON.stringify(plan)).not.toMatch(/https|private/)
  })
})
