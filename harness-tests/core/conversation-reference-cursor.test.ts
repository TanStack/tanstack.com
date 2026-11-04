import { describe, expect, it } from 'vitest'
import {
  decodeConversationReferenceCursor,
  encodeConversationReferenceCursor,
  ConversationReferenceCursorError,
  maxConversationReferenceCursorLength,
  maxConversationReferenceCursorBytes,
  type ConversationReferenceCursor,
} from '../../src/chat/core/conversation-reference-cursor'

const initial: ConversationReferenceCursor = {
  conversationId: 'personal:fixture/source',
  transcriptEpoch: 'epoch-one',
  offset: 0,
}
const continuation: ConversationReferenceCursor = {
  ...initial,
  before: 42,
  offset: 16_000,
  revision: 'revision-one',
}
const encodeRaw = (value: string | Uint8Array) =>
  Buffer.from(value).toString('base64url')
const packet = (value: unknown) => encodeRaw(JSON.stringify(value))
const wire = (value: ConversationReferenceCursor) => ({
  version: 1,
  conversationId: value.conversationId,
  transcriptEpoch: value.transcriptEpoch,
  ...(value.before === undefined ? {} : { before: value.before }),
  offset: value.offset,
  ...(value.revision === undefined ? {} : { revision: value.revision }),
})

describe('conversation reference cursor round trips', () => {
  it.each([
    { name: 'fresh current window', cursor: initial },
    { name: 'fresh archived window', cursor: { ...initial, before: 7 } },
    {
      name: 'current continuation',
      cursor: { ...initial, offset: 16_000, revision: 'current-revision' },
    },
    { name: 'archived continuation', cursor: continuation },
    {
      name: 'offset zero with revision for a stale-source check',
      cursor: { ...initial, revision: 'previous-revision' },
    },
    {
      name: 'largest safe sequence and offset',
      cursor: {
        ...continuation,
        before: Number.MAX_SAFE_INTEGER,
        offset: Number.MAX_SAFE_INTEGER,
      },
    },
  ])('round trips $name', ({ cursor }) => {
    const token = encodeConversationReferenceCursor(cursor)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(Buffer.from(token, 'base64url').toString('utf8')).toBe(
      JSON.stringify(wire(cursor)),
    )
    expect(decodeConversationReferenceCursor(token)).toEqual(cursor)
    expect(
      encodeConversationReferenceCursor(
        decodeConversationReferenceCursor(token),
      ),
    ).toBe(token)
  })

  it('uses the fixed wire key order regardless of input insertion order', () => {
    const cursor = {
      revision: continuation.revision,
      offset: continuation.offset,
      before: continuation.before,
      transcriptEpoch: continuation.transcriptEpoch,
      conversationId: continuation.conversationId,
    }
    const token = encodeConversationReferenceCursor(cursor)
    expect(token).toBe(packet(wire(continuation)))
    expect(
      Object.keys(JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))),
    ).toEqual([
      'version',
      'conversationId',
      'transcriptEpoch',
      'before',
      'offset',
      'revision',
    ])
    expect(decodeConversationReferenceCursor(token)).not.toHaveProperty(
      'version',
    )
  })

  it('omits optional undefined fields instead of adding null placeholders', () => {
    expect(
      encodeConversationReferenceCursor({
        ...initial,
        before: undefined,
        revision: undefined,
      }),
    ).toBe(encodeConversationReferenceCursor(initial))
    expect(
      decodeConversationReferenceCursor(
        encodeConversationReferenceCursor(initial),
      ),
    ).not.toHaveProperty('before')
    expect(
      decodeConversationReferenceCursor(
        encodeConversationReferenceCursor(initial),
      ),
    ).not.toHaveProperty('revision')
  })

  it.each([
    {
      name: 'control characters',
      conversationId: '\u0000'.repeat(1_000),
      transcriptEpoch: '\u001f'.repeat(128),
      revision: '\b'.repeat(200),
    },
    {
      name: 'lone surrogates',
      conversationId: '\ud800'.repeat(1_000),
      transcriptEpoch: '\udfff'.repeat(128),
      revision: '\ud800'.repeat(200),
    },
    {
      name: 'multibyte text',
      conversationId: '界'.repeat(1_000),
      transcriptEpoch: '🧪'.repeat(64),
      revision: '🦔'.repeat(100),
    },
  ])(
    'fits the largest allowed fields with $name without losing identity',
    ({ name: _, ...fields }) => {
      const cursor = {
        ...continuation,
        ...fields,
        before: Number.MAX_SAFE_INTEGER,
        offset: Number.MAX_SAFE_INTEGER,
      }
      const token = encodeConversationReferenceCursor(cursor)
      expect(token.length).toBeLessThanOrEqual(
        maxConversationReferenceCursorLength,
      )
      expect(Buffer.from(token, 'base64url').byteLength).toBeLessThanOrEqual(
        maxConversationReferenceCursorBytes,
      )
      expect(decodeConversationReferenceCursor(token)).toEqual(cursor)
    },
  )

  it('preserves opaque IDs without trimming, case folding, URL decoding, or Unicode normalization', () => {
    const cursor = {
      ...initial,
      conversationId: ' /Personal:%2F/#?\\\nCafe\u0301 ',
      transcriptEpoch: ' EPOCH:%2f\u0000 ',
      revision: ' Révision/%2F ',
    }
    expect(
      decodeConversationReferenceCursor(
        encodeConversationReferenceCursor(cursor),
      ),
    ).toEqual(cursor)
  })
})

describe('strict cursor data and continuation requirements', () => {
  it('requires a revision for a positive offset but allows an archived window to start without one', () => {
    const invalid = { ...initial, offset: 1 }
    expect(() => encodeConversationReferenceCursor(invalid)).toThrow()
    expect(() =>
      decodeConversationReferenceCursor(packet(wire(invalid))),
    ).toThrow()
    expect(
      decodeConversationReferenceCursor(
        encodeConversationReferenceCursor({ ...initial, before: 1 }),
      ),
    ).toEqual({ ...initial, before: 1 })
  })

  it.each([
    { conversationId: '' },
    { conversationId: 'x'.repeat(1_001) },
    { conversationId: null },
    { conversationId: 1 },
    { transcriptEpoch: '' },
    { transcriptEpoch: 'x'.repeat(129) },
    { transcriptEpoch: null },
    { revision: '' },
    { revision: 'x'.repeat(201) },
    { revision: null },
    { revision: true },
    { before: 0 },
    { before: -1 },
    { before: 1.5 },
    { before: Number.MAX_SAFE_INTEGER + 1 },
    { before: NaN },
    { before: Infinity },
    { before: '1' },
    { before: null },
    { offset: -1 },
    { offset: 0.5 },
    { offset: Number.MAX_SAFE_INTEGER + 1 },
    { offset: NaN },
    { offset: Infinity },
    { offset: '0' },
    { offset: null },
    { offset: false },
    { unexpected: 'ignored?' },
  ])('rejects invalid fields in both encoder and decoder: %j', (change) => {
    const value = { ...continuation, ...change }
    expect(() =>
      encodeConversationReferenceCursor(value as ConversationReferenceCursor),
    ).toThrow()
    expect(() =>
      decodeConversationReferenceCursor(
        packet({
          ...wire(value as ConversationReferenceCursor),
          ...('unexpected' in change ? { unexpected: change.unexpected } : {}),
        }),
      ),
    ).toThrow()
  })

  it.each(
    [
      null,
      [],
      'cursor',
      1,
      true,
      {},
      { ...wire(initial), version: 0 },
      { ...wire(initial), version: 2 },
      { ...wire(initial), version: '1' },
      {
        conversationId: initial.conversationId,
        transcriptEpoch: initial.transcriptEpoch,
        offset: 0,
      },
      { version: 1, transcriptEpoch: initial.transcriptEpoch, offset: 0 },
      { version: 1, conversationId: initial.conversationId, offset: 0 },
      {
        version: 1,
        conversationId: initial.conversationId,
        transcriptEpoch: initial.transcriptEpoch,
      },
    ].map((value) => ({ value })),
  )('rejects unsupported or incomplete wire data: $value', ({ value }) => {
    expect(() => decodeConversationReferenceCursor(packet(value))).toThrow()
  })
})

describe('canonical cursor encoding', () => {
  it.each([
    (json: string) => ' ' + json,
    (json: string) => json + '\n',
    (json: string) => JSON.stringify(JSON.parse(json), null, 2),
    (json: string) => json.replace('"version":1', '"version":1.0'),
    (json: string) => json.replace('"offset":0', '"offset":0e0'),
    (json: string) => json.replace('"offset":0', '"offset":-0'),
    (json: string) => json.replace('personal', '\\u0070ersonal'),
    (json: string) => json.replace('/source', '\\/source'),
    (json: string) => json.replace('"version":1,', '"version":1,"version":1,'),
    (json: string) => json.replace('"offset":0', '"offset":4,"offset":0'),
    (json: string) =>
      json.replace(
        '"conversationId":',
        '"conversationId":"other","conversationId":',
      ),
  ])('rejects equivalent but noncanonical JSON form %#', (transform) => {
    const original = JSON.stringify(wire(initial))
    const malformed = transform(original)
    expect(malformed).not.toBe(original)
    expect(() => JSON.parse(malformed)).not.toThrow()
    expect(() =>
      decodeConversationReferenceCursor(encodeRaw(malformed)),
    ).toThrow()
  })

  it('rejects valid fields written in a different key order', () => {
    expect(() =>
      decodeConversationReferenceCursor(
        packet({
          offset: 0,
          version: 1,
          transcriptEpoch: initial.transcriptEpoch,
          conversationId: initial.conversationId,
        }),
      ),
    ).toThrow()
  })

  it.each(['', '=', 'A', 'A===', '+/', 'not.a.cursor', '雪', '_-\n', 'AA AA'])(
    'rejects an invalid base64url token: %j',
    (token) => {
      expect(() => decodeConversationReferenceCursor(token)).toThrow()
    },
  )

  it('rejects padding and whitespace around an otherwise valid cursor', () => {
    const valid = encodeConversationReferenceCursor(initial)
    for (const token of [
      valid + '=',
      valid + '==',
      ' ' + valid,
      valid + '\n',
      valid.slice(0, 10) + '\t' + valid.slice(10),
    ]) {
      expect(() => decodeConversationReferenceCursor(token)).toThrow()
    }
  })

  it.each([1, 2])(
    'rejects nonzero unused trailing bits when decoded length modulo three is %s',
    (remainder) => {
      let cursor = { ...initial }
      while (
        Buffer.byteLength(JSON.stringify(wire(cursor))) % 3 !==
        remainder
      ) {
        cursor = { ...cursor, conversationId: cursor.conversationId + 'x' }
      }
      const valid = encodeConversationReferenceCursor(cursor)
      const alphabet =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
      const last = alphabet.indexOf(valid.at(-1)!)
      const ambiguous = valid.slice(0, -1) + alphabet[last | 1]
      expect(ambiguous).not.toBe(valid)
      expect(Buffer.from(ambiguous, 'base64url')).toEqual(
        Buffer.from(valid, 'base64url'),
      )
      expect(() => decodeConversationReferenceCursor(ambiguous)).toThrow()
    },
  )

  it.each([
    [0xc0, 0xaf],
    [0xe0, 0x80, 0xaf],
    [0xed, 0xa0, 0x80],
    [0xf4, 0x90, 0x80, 0x80],
    [0xe2, 0x82],
    [0x80],
  ])(
    'rejects malformed UTF-8 inside a JSON string, sequence %#',
    (...invalid) => {
      const prefix = Buffer.from('{"version":1,"conversationId":"')
      const suffix = Buffer.from('","transcriptEpoch":"epoch","offset":0}')
      const raw = Buffer.concat([prefix, Buffer.from(invalid), suffix])
      // A replacement-character decoder would turn these into valid JSON.
      expect(() => JSON.parse(raw.toString('utf8'))).not.toThrow()
      expect(() => decodeConversationReferenceCursor(encodeRaw(raw))).toThrow()
    },
  )

  it('rejects a UTF-8 byte-order mark instead of silently stripping it', () => {
    const raw = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(JSON.stringify(wire(initial))),
    ])
    expect(() => decodeConversationReferenceCursor(encodeRaw(raw))).toThrow()
  })

  it('rejects malformed JSON and unbounded tokens', () => {
    expect(maxConversationReferenceCursorLength).toBe(16_384)
    expect(maxConversationReferenceCursorBytes).toBe(12_288)
    for (const value of ['{', '{"version":1,}', 'null trailing']) {
      expect(() =>
        decodeConversationReferenceCursor(encodeRaw(value)),
      ).toThrow()
    }
    expect(() =>
      decodeConversationReferenceCursor('A'.repeat(16_385)),
    ).toThrow()
    expect(() =>
      decodeConversationReferenceCursor(encodeRaw(' '.repeat(12_289))),
    ).toThrow()
    expect(() =>
      encodeConversationReferenceCursor({
        ...initial,
        conversationId: 'x'.repeat(16_385),
      }),
    ).toThrow()
  })

  it('returns a stable public error without including malformed cursor contents', () => {
    const privateId = 'private-source-content'
    const invalid = packet({ ...wire(initial), unexpected: privateId })
    expect(() => decodeConversationReferenceCursor(invalid)).toThrow(
      ConversationReferenceCursorError,
    )
    try {
      decodeConversationReferenceCursor(invalid)
    } catch (error) {
      expect((error as Error).message).toBe(
        'The conversation cursor is invalid.',
      )
      expect((error as Error).message).not.toContain(privateId)
    }
  })
})
