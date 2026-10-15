import type { UIMessage } from '@tanstack/ai'
import { describe, expect, it } from 'vitest'
import type { MessageAttachment } from '../../src/chat/core/message-attachments'
import {
  parseRetryRequest,
  RetryRequestError,
} from '../../src/chat/core/retry-request'

const attachment: MessageAttachment = {
  id: 'abcdef00-1234-4567-89ab-012345678901',
  botId: 'source-bot',
  conversationId: 'source-conversation',
  name: 'notes.txt',
  mediaType: 'text/plain',
  size: 12,
  sha256: 'a'.repeat(64),
  source: 'upload',
  state: 'ready',
  createdAt: 100,
}
const fileReference = {
  kind: 'file' as const,
  botId: 'source-bot',
  conversationId: 'source-conversation',
  fileId: attachment.id,
  label: 'notes.txt',
}
const request = (overrides: Partial<UIMessage> = {}): UIMessage => ({
  id: 'request',
  role: 'user',
  parts: [{ type: 'text', content: 'Original request' }],
  ...overrides,
})

describe('restoring an original request', () => {
  it('retains exact text, selected source identities and model intent without authority', () => {
    const message = request({
      parts: [
        { type: 'text', content: '  Please read this.\n' },
        { type: 'text', content: '\nThen explain it.  ' },
      ],
      metadata: {
        gumAttachments: [attachment],
        gumReferences: [
          fileReference,
          { kind: 'connection', serverId: 'mcp:tools', label: 'Tools' },
        ],
        gumRunModel: {
          provider: 'openai',
          model: 'original-model',
          reasoning: 'low',
        },
        gumInherited: true,
        gumOrigin: { kind: 'schedule', scheduleId: 'not-authority' },
        arbitrary: { approval: true },
      },
    })
    const restored = parseRetryRequest(message)
    expect(restored).toEqual({
      text: '  Please read this.\n\n\nThen explain it.  ',
      attachments: [attachment],
      references: [
        fileReference,
        { kind: 'connection', serverId: 'mcp:tools', label: 'Tools' },
      ],
      runModel: {
        provider: 'openai',
        model: 'original-model',
        reasoning: 'low',
      },
    })
    expect(restored.attachments[0]).not.toBe(attachment)
    expect(restored.references[0]).not.toBe(fileReference)
    expect(message.metadata?.gumAttachments).toEqual([attachment])
  })

  it('accepts legacy text-only requests without inventing model intent', () => {
    expect(parseRetryRequest(request())).toEqual({
      text: 'Original request',
      attachments: [],
      references: [],
    })
  })

  it('retains tool, conversation and pinned skill identities', () => {
    const references = [
      {
        kind: 'tool',
        serverId: 'mcp:tools',
        toolName: 'find_records',
        label: 'Find records',
      },
      {
        kind: 'conversation',
        botId: 'another-bot',
        conversationId: 'a different opaque conversation',
        label: 'Notes',
      },
      {
        kind: 'skill',
        skillId: 'abcdef00-1234-4567-89ab-012345678902',
        version: 7,
        label: 'Review',
      },
    ]
    expect(
      parseRetryRequest(request({ metadata: { gumReferences: references } }))
        .references,
    ).toEqual(references)
  })

  it('rejects invalid metadata containers instead of treating them as text-only requests', () => {
    for (const metadata of [null, [], 'broken', 42])
      expect(() =>
        parseRetryRequest(
          request({ metadata: metadata as unknown as UIMessage['metadata'] }),
        ),
      ).toThrow(RetryRequestError)
  })

  it('retains files-only requests and references-only file selections', () => {
    expect(
      parseRetryRequest(
        request({ parts: [], metadata: { gumAttachments: [attachment] } }),
      ).attachments,
    ).toEqual([attachment])
    expect(
      parseRetryRequest(
        request({
          parts: [{ type: 'text', content: '  ' }],
          metadata: { gumReferences: [fileReference] },
        }),
      ).text,
    ).toBe('  ')
  })

  it.each(['assistant', 'system', 'tool'])('rejects a %s message', (role) => {
    expect(() => {
      // @ts-expect-error Includes an unsupported tool role at the runtime boundary.
      return parseRetryRequest({ ...request(), role })
    }).toThrow(RetryRequestError)
  })

  it.each(
    [
      [],
      [{ type: 'text', content: ' \n\t ' }],
      [{ type: 'text', content: 'a'.repeat(12001) }],
      [
        { type: 'text', content: 'a'.repeat(12000) },
        { type: 'text', content: '' },
      ],
      [{ type: 'text', content: 42 }],
      [
        { type: 'text', content: 'Hello' },
        {
          type: 'image',
          source: { type: 'url', url: 'https://example.test/image' },
        },
      ],
      [{ type: 'tool-call', id: 'call', name: 'tool', arguments: '{}' }],
    ].map((parts) => ({ parts })),
  )(
    'rejects empty, oversized or unsupported parts without dropping input (%j)',
    ({ parts }) => {
      expect(() =>
        // Intentionally malformed saved input exercises the runtime rejection boundary.
        // @ts-expect-error Includes unsupported parts and non-string text.
        parseRetryRequest({ ...request(), parts }),
      ).toThrow(RetryRequestError)
    },
  )

  it('accepts the exact text limit', () => {
    expect(
      parseRetryRequest(
        request({ parts: [{ type: 'text', content: 'a'.repeat(12000) }] }),
      ).text,
    ).toHaveLength(12000)
  })

  it.each(['gumAttachments', 'gumReferences', 'gumRunModel'])(
    'rejects malformed present %s rather than falling back',
    (field) => {
      for (const value of [undefined, null, 'broken', {}, 42]) {
        expect(() =>
          parseRetryRequest(request({ metadata: { [field]: value } })),
        ).toThrow(RetryRequestError)
      }
    },
  )

  it('rejects partially readable or duplicate attachment metadata', () => {
    for (const files of [
      [attachment, { ...attachment, id: 'broken' }],
      [attachment, attachment],
      [{ ...attachment, state: 'pending' }],
      Array(6).fill(attachment),
    ]) {
      expect(() =>
        parseRetryRequest(request({ metadata: { gumAttachments: files } })),
      ).toThrow(RetryRequestError)
    }
  })

  it('rejects partially readable, duplicate or conflicting reference selections', () => {
    const skill = {
      kind: 'skill',
      skillId: 'abcdef00-1234-4567-89ab-012345678902',
      version: 1,
      label: 'Review',
    }
    for (const references of [
      [fileReference, { kind: 'unsupported', label: 'Lost input' }],
      [fileReference, fileReference],
      [skill, { ...skill, version: 2 }],
      Array.from({ length: 11 }, (_, index) => ({
        kind: 'connection',
        serverId: `server-${index}`,
        label: 'Server',
      })),
    ]) {
      expect(() =>
        parseRetryRequest(request({ metadata: { gumReferences: references } })),
      ).toThrow(RetryRequestError)
    }
  })

  it('does not treat a connection or skill alone as request content', () => {
    expect(() =>
      parseRetryRequest(
        request({
          parts: [],
          metadata: {
            gumReferences: [
              { kind: 'connection', serverId: 'server', label: 'Server' },
            ],
          },
        }),
      ),
    ).toThrow(RetryRequestError)
  })

  it('does not copy file payloads, URLs or unknown metadata into the restored request', () => {
    const restored = parseRetryRequest(
      request({
        metadata: {
          gumAttachments: [
            {
              ...attachment,
              bytes: 'secret',
              url: 'https://example.test/private',
            },
          ],
          gumReferences: [{ ...fileReference, granted: true }],
          approval: true,
        },
      }),
    )
    expect(restored.attachments).toEqual([attachment])
    expect(restored.references).toEqual([fileReference])
    expect(JSON.stringify(restored)).not.toMatch(
      /secret|https|granted|approval/,
    )
  })
})
