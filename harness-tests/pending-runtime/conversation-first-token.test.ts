import { expect, it, vi } from 'vitest'
import { conversationHarness } from './fixtures/conversation-runtime'

it.each(['', ' \n'])(
  'persists the first visible token before completion after leading %j',
  async (leading) => {
    const h = await conversationHarness()
    let release = () => {}
    const finish = new Promise<void>((resolve) => {
      release = resolve
    })
    const encoder = new TextEncoder()
    const chunk = (delta: Record<string, string>, reason: string | null) =>
      'data: ' +
      JSON.stringify({
        id: 'synthetic-first-token',
        object: 'chat.completion.chunk',
        created: 1,
        model: h.env.INCLUDED_MODEL,
        choices: [{ index: 0, delta, finish_reason: reason }],
        ...(reason === 'stop'
          ? {
              usage: {
                prompt_tokens: 1,
                completion_tokens: 1,
                total_tokens: 2,
              },
            }
          : {}),
      }) +
      '\n\n'
    h.env.AI.run.mockImplementation(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            async start(controller) {
              if (leading)
                controller.enqueue(
                  encoder.encode(
                    chunk({ role: 'assistant', content: leading }, null),
                  ),
                )
              controller.enqueue(
                encoder.encode(
                  chunk(
                    { role: 'assistant', content: 'First visible token' },
                    null,
                  ),
                ),
              )
              await finish
              controller.enqueue(
                encoder.encode(chunk({}, 'stop') + 'data: [DONE]\n\n'),
              )
              controller.close()
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    )
    try {
      await h.c.begin({ ...h.input('first-token-persistence'), fixture: false })
      await vi.waitFor(() => {
        const row = h.local.prepare('SELECT json FROM state WHERE id=1').get()
        expect(row?.json).toContain('First visible token')
      })
      expect((await h.c.snapshot()).status).toBe('running')
    } finally {
      release()
      await h.settle()
      expect((await h.c.snapshot()).status).toBe('idle')
      expect(
        h.local.prepare('SELECT json FROM state WHERE id=1').get()?.json,
      ).toContain('First visible token')
    }
  },
)
