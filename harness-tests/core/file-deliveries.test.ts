import { describe, expect, it } from 'vitest'
import { readFileDeliveries } from '../../src/chat/core/file-deliveries'
import {
  copyMessage,
  projectBranchContext,
} from '../../src/chat/core/conversation-copy'
import { deliveredMessage, fileDeliveryFixture } from './fixtures/file-delivery'

describe('native file delivery projection', () => {
  it('does not promote model text, MCP results, uploads, or unrelated call metadata into delivered files', () => {
    const native = deliveredMessage()
    const noMetadata = { ...native, metadata: undefined }
    noMetadata.parts[0] = {
      ...noMetadata.parts[0],
      output: {
        ok: true,
        file: fileDeliveryFixture.file,
        gumFileDeliveries: [fileDeliveryFixture],
      },
    } as (typeof noMetadata.parts)[0]
    expect(readFileDeliveries(noMetadata)).toEqual([])
    expect(readFileDeliveries({ ...native, role: 'user' })).toEqual([])
    expect(
      readFileDeliveries({
        ...native,
        parts: [
          { type: 'tool-call', id: 'save-call', name: 'call_connected_tool' },
        ],
      }),
    ).toEqual([])
    expect(
      readFileDeliveries({
        ...native,
        metadata: {
          gumFileDeliveries: [
            { ...fileDeliveryFixture, toolCallId: 'different-call' },
          ],
        },
      }),
    ).toEqual([])
    expect(
      readFileDeliveries({
        ...native,
        metadata: {
          gumFileDeliveries: [
            {
              ...fileDeliveryFixture,
              file: { ...fileDeliveryFixture.file, source: 'upload' },
            },
          ],
        },
      }),
    ).toEqual([])
  })

  it('keeps confirmed delivery after an interrupted reply and strips arbitrary fields and duplicate receipts', () => {
    const message = deliveredMessage()
    const call = message.parts[0]
    if (call.type === 'tool-call') call.state = 'error'
    message.metadata = {
      gumFileDeliveries: [
        {
          ...fileDeliveryFixture,
          secret: 'never-display',
          viewUrl: 'https://untrusted.invalid',
          file: { ...fileDeliveryFixture.file, content: 'never-inline' },
        },
        fileDeliveryFixture,
        {
          ...fileDeliveryFixture,
          file: { ...fileDeliveryFixture.file, state: 'pending' },
        },
        { ...fileDeliveryFixture, workspaceId: '../another' },
      ],
    }
    expect(readFileDeliveries(message)).toEqual([fileDeliveryFixture])
  })

  it('retains original delivery scope when copying without making historical outputs new model attachments', () => {
    const copied = copyMessage(deliveredMessage())
    expect(readFileDeliveries(copied)).toEqual([fileDeliveryFixture])
    expect(copied.metadata?.gumInherited).toBe(true)
    const projected = projectBranchContext([copied])[0]
    expect(readFileDeliveries(projected)).toEqual([])
    expect(projected.metadata).toBeUndefined()
    expect(projected.parts[0].type).toBe('text')
    expect(projected.parts.filter((part) => part.type === 'tool-call')).toEqual(
      [],
    )
  })
})

it('distinguishes existing-file references from save receipts and preserves their exact source through copies', () => {
  const base = deliveredMessage()
  const reference = {
    ...fileDeliveryFixture,
    kind: 'file-reference' as const,
    file: {
      ...fileDeliveryFixture.file,
      source: 'upload' as const,
      conversationId: 'thread:original',
    },
  }
  const message = {
    ...base,
    parts: base.parts.map((part) =>
      part.type === 'tool-call'
        ? { ...part, name: 'present_file', state: 'error' as const }
        : part,
    ),
    metadata: { gumFileDeliveries: [reference] },
  }
  expect(readFileDeliveries(message)).toEqual([reference])
  expect(readFileDeliveries({ ...message, parts: base.parts })).toEqual([])
  expect(
    readFileDeliveries({
      ...message,
      metadata: { gumFileDeliveries: [fileDeliveryFixture] },
    }),
  ).toEqual([])
  expect(readFileDeliveries({ ...message, metadata: undefined })).toEqual([])
  const copied = copyMessage(message)
  expect(copied.metadata?.gumInherited).toBe(true)
  expect(readFileDeliveries(copied)).toEqual([reference])
  expect(readFileDeliveries(projectBranchContext([copied])[0])).toEqual([])
})
