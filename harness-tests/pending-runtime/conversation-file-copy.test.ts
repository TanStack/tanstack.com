import './fixtures/loaded-assistant-tools'
import { afterEach, expect, it, vi } from 'vitest'
import { defaultPolicy } from '../../src/chat/core/types'
import { readFileDeliveries } from '../../src/chat/core/file-deliveries'
import { SavedFiles } from '../../src/chat/server/saved-files'
import { conversationHarness } from './fixtures/conversation-runtime'

afterEach(() => vi.restoreAllMocks())

it.each([false, true])(
  'copies source bytes through the real SDK and Conversation, interrupted publication: %s',
  async (publicationInterrupted) => {
    const h = await conversationHarness()
    const objects = new Map<string, Uint8Array>()
    async function metadata(key: string) {
      const bytes = objects.get(key)
      return bytes
        ? {
            size: bytes.length,
            checksums: {
              sha256: await crypto.subtle.digest(
                'SHA-256',
                Uint8Array.from(bytes).buffer,
              ),
            },
          }
        : null
    }
    const put = vi.fn(async (key: string, bytes: Uint8Array) => {
      if (objects.has(key)) return null
      objects.set(key, new Uint8Array(bytes))
      return metadata(key)
    })
    ;(h.env as any).FILES = {
      put,
      head: metadata,
      get: async (key: string) => {
        const stored = await metadata(key)
        return (
          stored && {
            ...stored,
            body: new Response(Uint8Array.from(objects.get(key)!).buffer).body,
            arrayBuffer: async () => Uint8Array.from(objects.get(key)!).buffer,
          }
        )
      },
    }
    const files = new SavedFiles(h.env as any, {
      workspaceId: 'w',
      userId: '00000000-0000-4000-8000-000000000001',
      botId: 'b',
      conversationId: 'main-conversation',
    })
    const bytes = new TextEncoder().encode(
      '\uFEFF# Private source\r\n\r\n- café 🌲\r\n',
    )
    const source = await files.save(
      {
        id: crypto.randomUUID(),
        name: 'source.md',
        mediaType: 'text/markdown',
        source: 'upload',
      },
      bytes,
    )
    if (publicationInterrupted)
      vi.spyOn((h.c as any).fileDelivery, 'confirm').mockImplementationOnce(
        () => {
          throw new Error('Publication interrupted after storage')
        },
      )
    const run = vi.fn(async (_model: string, _input: unknown) => {
      const pass = run.mock.calls.length - 1
      if (pass > 1) throw new Error('Unexpected extra model request')
      const frame = (delta: unknown, finish: string | null = null) =>
        'data: ' +
        JSON.stringify({
          id: 'copy-completion-' + pass,
          object: 'chat.completion.chunk',
          created: 1,
          model: h.env.INCLUDED_MODEL,
          choices: [{ index: 0, delta, finish_reason: finish }],
        }) +
        '\n\n'
      const body =
        pass === 0
          ? frame({
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'native-copy-call',
                  type: 'function',
                  function: {
                    name: 'copy_file',
                    arguments: JSON.stringify({
                      sourceFileId: source.id,
                      name: 'exact-copy.md',
                    }),
                  },
                },
              ],
            }) + frame({}, 'tool_calls')
          : frame({ role: 'assistant', content: 'The file was copied.' }) +
            frame({}, 'stop')
      return new Response(body + 'data: [DONE]\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
      })
    })
    ;(h.env as any).AI = { run }
    const kody = vi
      .spyOn(h.c as any, 'measuredKody')
      .mockRejectedValue(new Error('Unexpected external tool'))
    await h.c.begin({
      ...h.input(
        'copy-task',
        `Copy source file ${source.id} as exact-copy.md without changing it.`,
      ),
      fixture: false,
      policy: { ...defaultPolicy, allowKody: false, allowMcp: false },
    })
    await h.settle()
    const state = await h.c.snapshot()
    expect(state.error).toBeUndefined()
    expect(state.assistantTask?.status).toBe('answered')
    expect(run).toHaveBeenCalledTimes(2)
    expect(kody).not.toHaveBeenCalled()
    const saved = await files.list()
    expect(saved).toHaveLength(2)
    const copied = saved.find((file) => file.id !== source.id)!
    expect(copied).toMatchObject({
      name: 'exact-copy.md',
      source: 'assistant',
      state: 'ready',
      mediaType: source.mediaType,
      sha256: source.sha256,
      size: source.size,
      conversationId: 'main-conversation',
    })
    expect(objects.get(`saved-files/${copied.id}`)).toEqual(bytes)
    expect(objects.get(`saved-files/${source.id}`)).toEqual(bytes)
    expect(JSON.stringify(run.mock.calls)).not.toContain('Private source')
    expect(JSON.stringify(run.mock.calls)).not.toContain('café')
    if (publicationInterrupted)
      expect(state.messages.flatMap(readFileDeliveries)).toEqual([])
    else
      expect(state.messages.flatMap(readFileDeliveries)).toEqual([
        {
          kind: 'file-copy',
          workspaceId: 'w',
          toolCallId: 'native-copy-call',
          file: copied,
        },
      ])
    const restored = await h.reconstruct()
    expect(
      (await restored.snapshot()).messages.flatMap(readFileDeliveries),
    ).toEqual([
      {
        kind: 'file-copy',
        workspaceId: 'w',
        toolCallId: 'native-copy-call',
        file: copied,
      },
    ])
    expect(put).toHaveBeenCalledTimes(2)
    expect(await files.list()).toHaveLength(2)
    expect(run).toHaveBeenCalledTimes(2)
  },
)
