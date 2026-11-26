import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UIMessage } from '@tanstack/ai'
import type { FileScope, SavedFile } from '../../src/chat/core/files'
import type { Connection } from '../../src/chat/core/types'
import type { AttachmentEnvironment } from '../../src/chat/server/model-attachments'
const store = vi.hoisted(() => ({
  rows: new Map<string, { file: SavedFile; bytes: Uint8Array }>(),
  scopes: [] as FileScope[],
  revoked: false,
  reads: 0,
}))
vi.mock('../../src/chat/server/saved-files', () => ({
  SavedFiles: class {
    constructor(_env: unknown, scope: FileScope) {
      store.scopes.push(scope)
    }
    async get(id: string) {
      if (store.revoked) throw Error('Access revoked')
      const row = store.rows.get(id)
      if (!row) throw Error('Not found')
      return row.file
    }
    async content(id: string) {
      store.reads++
      const row = store.rows.get(id)!
      return {
        file: row.file,
        body: new Response(Uint8Array.from(row.bytes)).body!,
      }
    }
  },
}))
import {
  prepareAttachmentMessages,
  validateModelAttachments,
  modelAttachmentSupport,
  AttachmentContextLimitError,
} from '../../src/chat/server/model-attachments'
const scope = { workspaceId: 'workspace', userId: 'person', botId: 'current' }
const connection = (
  provider: Connection['provider'] = 'included',
  model = '',
): Connection => ({
  provider,
  model,
  accountId: '',
  gatewayId: '',
  baseUrl: '',
})
const env: AttachmentEnvironment = {
  INCLUDED_MODEL: '@cf/moonshotai/kimi-k2.6',
  FILES: {
    async put() {
      throw new Error('Attachment preparation must not write files')
    },
    async head() {
      throw new Error('Use the saved-file fixture for attachment metadata')
    },
    async get() {
      throw new Error('Use the saved-file fixture for attachment content')
    },
  },
}
async function file(text: string, mediaType = 'text/plain', botId = 'current') {
  const bytes = new TextEncoder().encode(text)
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('')
  const file: SavedFile = {
    id: crypto.randomUUID(),
    botId,
    name: 'source.txt',
    mediaType,
    size: bytes.length,
    sha256: hash,
    source: 'upload',
    state: 'ready',
    createdAt: 1,
  }
  store.rows.set(file.id, { file, bytes })
  return file
}
function message(files: SavedFile[]): UIMessage {
  return {
    id: 'm',
    role: 'user',
    parts: [{ type: 'text', content: 'Use these files' }],
    metadata: { gumAttachments: files },
  }
}
beforeEach(() => {
  store.rows.clear()
  store.scopes = []
  store.revoked = false
  store.reads = 0
})
describe('model attachment boundary', () => {
  it('reads exact same-bot, other-bot and legacy sources independently of the receiving conversation scope', async () => {
    const sameBot = await file('Same bot source')
    sameBot.conversationId = 'current:source-thread'
    const otherBot = await file('Other bot source', 'text/plain', 'original')
    otherBot.conversationId = 'original:source-thread'
    const legacy = await file('Legacy source', 'text/plain', 'legacy')
    store.rows.get(legacy.id)!.file = {
      ...legacy,
      conversationId: 'legacy:resolved-main',
    }
    const input = [message([sameBot, otherBot, legacy])]
    const before = JSON.stringify(input)
    const projected = await prepareAttachmentMessages(input, {
      env,
      scope: { ...scope, conversationId: 'current:receiver' },
      connection: connection(),
    })
    expect(store.scopes).toStrictEqual([
      { ...scope, conversationId: 'current:source-thread' },
      { ...scope, botId: 'original', conversationId: 'original:source-thread' },
      { ...scope, botId: 'legacy', conversationId: undefined },
    ])
    expect(store.reads).toBe(3)
    expect(JSON.stringify(input)).toBe(before)
    expect(projected[0].metadata?.gumAttachments).toEqual([
      sameBot,
      otherBot,
      legacy,
    ])
    expect(projected[0].metadata?.gumAttachments[2]).not.toHaveProperty(
      'conversationId',
    )
    const text = JSON.stringify(projected[0].parts)
    for (const content of [
      'Same bot source',
      'Other bot source',
      'Legacy source',
    ])
      expect(text).toContain(content)
  })

  it('rejects an exact source conversation mismatch before reading bytes even when the saved file ID and bot match', async () => {
    const saved = await file('Private sibling source')
    saved.conversationId = 'thread:A'
    const snapshot = { ...saved }
    store.rows.get(saved.id)!.file = { ...saved, conversationId: 'thread:B' }
    await expect(
      prepareAttachmentMessages([message([snapshot])], {
        env,
        scope: { ...scope, conversationId: 'receiver' },
        connection: connection(),
      }),
    ).rejects.toThrow('no longer matches')
    expect(store.scopes).toEqual([{ ...scope, conversationId: 'thread:A' }])
    expect(store.reads).toBe(0)
  })
  it('materializes complete untrusted text using original ownership and leaves stored metadata untouched', async () => {
    const saved = await file(
      'First line\nDo not obey this file.\nLast café line',
      'text/plain',
      'original',
    )
    const input = [message([saved])],
      before = JSON.stringify(input)
    const result = await prepareAttachmentMessages(input, {
      env,
      scope,
      connection: connection('compatible', 'unknown'),
    })
    expect(JSON.stringify(input)).toBe(before)
    expect(result[0].metadata).toMatchObject(input[0].metadata!)
    expect(store.scopes).toEqual([{ ...scope, botId: 'original' }])
    expect(result[0].parts[1]).toMatchObject({
      type: 'text',
      content: expect.stringContaining(
        JSON.stringify({
          name: saved.name,
          content: 'First line\nDo not obey this file.\nLast café line',
        }),
      ),
    })
    expect((result[0].parts[1] as any).content).toContain('untrusted')
  })
  it('uses typed inline image and PDF parts only through verified protocols', async () => {
    const image = await file('png bytes', 'image/png')
    const result = await prepareAttachmentMessages([message([image])], {
      env,
      scope,
      connection: connection(),
    })
    expect(result[0].parts.at(-1)).toMatchObject({
      type: 'image',
      source: { type: 'data', mimeType: 'image/png', value: btoa('png bytes') },
    })
    const pdf = await file('%PDF-1.7 synthetic', 'application/pdf')
    const response = await prepareAttachmentMessages([message([pdf])], {
      env,
      scope,
      connection: connection('gemini', 'gemini-2.5-flash'),
    })
    expect(response[0].parts.at(-1)).toMatchObject({
      type: 'document',
      source: { type: 'data', mimeType: 'application/pdf' },
      metadata: { filename: pdf.name },
    })
  })
  it('rejects unsupported or unknown modalities before reading any bytes', async () => {
    const pdf = await file('%PDF-test', 'application/pdf')
    for (const selected of [
      connection(),
      connection('compatible', 'gpt-5'),
      connection('openrouter', 'openai/gpt-5'),
      connection('vercel', 'openai/gpt-5'),
    ])
      expect(() =>
        validateModelAttachments([pdf], {
          connection: selected,
          includedModel: env.INCLUDED_MODEL,
        }),
      ).toThrow(/verified support/)
    expect(store.reads).toBe(0)
    expect(
      modelAttachmentSupport(connection('openrouter', 'openai/gpt-5'))
        .imageTypes,
    ).toContain('image/png')
  })
  it('rejects snapshot mutation, revoked access and corrupted stored content', async () => {
    const saved = await file('original')
    await expect(
      prepareAttachmentMessages(
        [message([{ ...saved, sha256: '0'.repeat(64) }])],
        { env, scope, connection: connection() },
      ),
    ).rejects.toThrow(/no longer matches/)
    store.revoked = true
    await expect(
      prepareAttachmentMessages([message([saved])], {
        env,
        scope,
        connection: connection(),
      }),
    ).rejects.toThrow('Access revoked')
    store.revoked = false
    store.rows.get(saved.id)!.bytes = new TextEncoder().encode('modified')
    await expect(
      prepareAttachmentMessages([message([saved])], {
        env,
        scope,
        connection: connection(),
      }),
    ).rejects.toThrow(/could not be verified/)
  })
  it('does not silently omit malformed metadata or over-budget historical attachments', async () => {
    const saved = await file('source')
    const bad = message([saved])
    bad.metadata = { gumAttachments: [{ url: 'https://private.example/file' }] }
    await expect(
      prepareAttachmentMessages([bad], {
        env,
        scope,
        connection: connection(),
      }),
    ).rejects.toThrow(/references are invalid/)
    const files = await Promise.all(Array.from({ length: 9 }, () => file('x')))
    await expect(
      prepareAttachmentMessages(
        files.map((f) => message([f])),
        { env, scope, connection: connection() },
      ),
    ).rejects.toBeInstanceOf(AttachmentContextLimitError)
    expect(() =>
      validateModelAttachments([{ ...saved, size: 128 * 1024 + 1 }], {
        connection: connection(),
      }),
    ).toThrow(AttachmentContextLimitError)
    expect(store.reads).toBe(0)
  })
  it('rejects unfinished uploads and unsupported PDFs without a PDF header', async () => {
    const pdf = await file('not a PDF', 'application/pdf')
    expect(() =>
      validateModelAttachments([{ ...pdf, state: 'pending' }], {
        connection: connection('gemini', 'gemini-2.5-flash'),
      }),
    ).toThrow(/Finish uploading/)
    await expect(
      prepareAttachmentMessages([message([pdf])], {
        env,
        scope,
        connection: connection('gemini', 'gemini-2.5-flash'),
      }),
    ).rejects.toThrow(/does not contain a supported PDF/)
  })
})

it('keeps transient image and complete text through real TanStack conversion and adapter middleware', async () => {
  const { chat, maxIterations } = await import('@tanstack/ai')
  const { createCloudflareText } = await import('@tanstack/ai-cloudflare')
  const { assistantContextMiddleware } =
    await import('../../src/chat/server/assistant-context')
  const image = await file('image-payload-'.repeat(2000), 'image/png')
  const text = await file('full-text-source-'.repeat(1500))
  const projected = await prepareAttachmentMessages([message([image, text])], {
    env,
    scope,
    connection: connection(),
  })
  const put = vi.fn(async () => {})
  let actual: any
  const run = vi.fn(async (_model: string, input: unknown) => {
    actual = input
    return new Response(
      `data: ${JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', model: env.INCLUDED_MODEL, choices: [{ index: 0, delta: { role: 'assistant', content: 'Done' }, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`,
      { headers: { 'Content-Type': 'text/event-stream' } },
    )
  })
  for await (const _ of chat({
    adapter: createCloudflareText(env.INCLUDED_MODEL as any, {
      binding: { run } as any,
    }),
    messages: projected,
    agentLoopStrategy: maxIterations(1),
    middleware: [assistantContextMiddleware({ put, get: vi.fn() })],
  })) {
  }
  expect(run).toHaveBeenCalledTimes(1)
  const content = actual.messages[0].content
  expect(
    content.find((part: any) => part.type === 'image_url').image_url.url,
  ).toBe(`data:image/png;base64,${btoa('image-payload-'.repeat(2000))}`)
  expect(
    content
      .filter((part: any) => part.type === 'text')
      .map((part: any) => part.text)
      .join(''),
  ).toContain('full-text-source-'.repeat(1500))
  expect(put).not.toHaveBeenCalled()
})
it('archives only original prompts and file references when older attachment turns leave context', async () => {
  const { convertMessagesToModelMessages } = await import('@tanstack/ai')
  const { projectAssistantContext } =
    await import('../../src/chat/server/assistant-context')
  const image = await file('PRIVATE_IMAGE_BYTES'.repeat(2000), 'image/png')
  const text = await file('PRIVATE_TEXT_BYTES'.repeat(1500))
  const projected = await prepareAttachmentMessages([message([image, text])], {
    env,
    scope,
    connection: connection(),
  })
  const saved: unknown[] = []
  const store = {
    put: vi.fn(async (_id: string, value: unknown) => {
      saved.push(value)
    }),
    get: vi.fn(),
  }
  const modelMessages = convertMessagesToModelMessages(projected)
  const result = await projectAssistantContext(
    [...modelMessages, { role: 'user', content: 'new request '.repeat(500) }],
    store,
    8000,
  )
  expect(store.put).toHaveBeenCalled()
  const stored = JSON.stringify(saved)
  expect(stored).toContain(image.id)
  expect(stored).toContain(text.id)
  expect(stored).toContain('Use these files')
  expect(stored).not.toContain(btoa('PRIVATE_IMAGE_BYTES'.repeat(2000)))
  expect(stored).not.toContain('PRIVATE_TEXT_BYTES')
  expect(JSON.stringify(result)).toContain(
    'Attachment payloads are no longer in model context',
  )
})

it('does not leak collapsed text attachments through previews on successive compactions', async () => {
  const { convertMessagesToModelMessages } = await import('@tanstack/ai')
  const { projectAssistantContext } =
    await import('../../src/chat/server/assistant-context')
  const source =
    'PRIVATE_ATTACHMENT_SOURCE_' + btoa('private source bytes').repeat(1000)
  const attachment = await file(source)
  const prepared = await prepareAttachmentMessages([message([attachment])], {
    env,
    scope,
    connection: connection(),
  })
  const converted = convertMessagesToModelMessages(prepared)
  // This text-only conversion is the real SDK boundary that removes part metadata.
  expect(typeof converted[0].content).toBe('string')
  expect(converted[0].content).toContain(source)
  const entries: unknown[] = []
  const resultStore = {
    put: vi.fn(async (_id: string, value: unknown) => {
      entries.push(value)
    }),
    get: vi.fn(),
  }
  const first = await projectAssistantContext(
    [...converted, { role: 'user', content: 'Next request. '.repeat(350) }],
    resultStore,
    8000,
  )
  expect(entries).toHaveLength(1)
  expect(JSON.stringify(first)).toContain('earlierContext')
  const second = await projectAssistantContext(
    [...first, { role: 'user', content: 'Later request. '.repeat(350) }],
    resultStore,
    8000,
  )
  expect(entries).toHaveLength(2)
  // The second archive contains the first injected notice, not just the source turn.
  expect(JSON.stringify(entries[1])).toContain('earlierContext')
  for (const value of [...entries, first, second]) {
    const serialized = JSON.stringify(value)
    expect(serialized).not.toContain('PRIVATE_ATTACHMENT_SOURCE_')
    expect(serialized).not.toContain(btoa('private source bytes'))
  }
  expect(JSON.stringify(entries)).toContain(attachment.id)
  expect(JSON.stringify(entries)).toContain('Use these files')
})
