import { describe, it, expect, vi } from 'vitest'
import {
  runResearchLoop,
  type ResearchServices,
  type Evaluation,
  type SourceAction,
} from '../../src/chat/core/research-loop'
const evidence = {
  text: 'Nintendo was founded by Fusajiro Yamauchi in 1889.',
  title: 'Nintendo',
  url: 'https://en.wikipedia.org/wiki/Nintendo',
}
const context = {
  question: 'Who founded Nintendo?',
  recentMessages: [],
  modelAllowed: false,
}
const pick = (
  values: Record<string, string>,
  probability = 0.99,
): Evaluation => {
  const mapped = { ...values }
  if (mapped.source) {
    mapped.action = mapped.source
    delete mapped.source
  }
  if (mapped.passage) {
    mapped.action = mapped.passage
    delete mapped.passage
  }
  return {
    answers: Object.fromEntries(
      Object.entries(mapped).map(([k, value]) => [k, { value, probability }]),
    ),
    inputTokens: 100,
    outputTokens: 10,
  }
}
function io() {
  const calls: string[] = []
  const evaluate = vi
    .fn()
    .mockImplementationOnce(async () => {
      calls.push('decide')
      return pick({ action: 'search', source: 's' })
    })
    .mockImplementationOnce(async () => {
      calls.push('decide')
      return pick({ action: 'read', source: 'r' })
    })
    .mockImplementationOnce(async () => {
      calls.push('decide')
      return pick({ action: 'answer', passage: 'e0' })
    })
    .mockImplementationOnce(async () => {
      calls.push('verify')
      return pick({ supported: 'yes' })
    })
  const execute = vi.fn(async (a) => {
    calls.push(a.tool)
    return a.tool === 'search'
      ? { articles: [{ title: 'Nintendo', description: 'Company' }] }
      : { evidence: [evidence] }
  })
  const services: ResearchServices = {
    evaluate,
    event: vi.fn(async () => {}),
    plugins: [
      {
        id: 'test',
        candidates: (state) => {
          const actions: SourceAction[] = [
            {
              id: 's',
              tool: 'search',
              description: 'Search',
              input: { query: 'Nintendo' },
              effect: { search: 'Nintendo' },
            },
          ]
          if (state.articles.length)
            actions.push({
              id: 'r',
              tool: 'read',
              description: 'Read',
              input: { title: 'Nintendo' },
              effect: { read: 'Nintendo' },
            })
          return actions
        },
        execute,
      },
    ],
  }
  return { services, calls, evaluate, execute }
}
const signal = () => new AbortController().signal
describe('Gum research loop', () => {
  it('authorizes every source call and verifies evidence without a chat model', async () => {
    const x = io()
    const result = await runResearchLoop(context, x.services, signal())
    expect(x.calls).toEqual([
      'decide',
      'search',
      'decide',
      'read',
      'decide',
      'verify',
    ])
    expect(result.text).toContain('Fusajiro Yamauchi')
    expect(result.usage).toEqual({
      jevCalls: 4,
      chatModelCalls: 0,
      searches: 1,
      sourceCalls: 2,
      inputTokens: 400,
      outputTokens: 40,
    })
  })
  it('makes follow-up subjects available without generating a query', async () => {
    const x = io()
    await runResearchLoop(
      {
        ...context,
        question: 'When was it founded?',
        recentMessages: [{ role: 'user', text: context.question }],
      },
      x.services,
      signal(),
    )
    expect(x.evaluate.mock.calls[0][0].recentMessages[0].text).toContain(
      'Nintendo',
    )
    expect(x.evaluate.mock.calls[0][0].question).toBe('When was it founded?')
  })
  it('does not trust uncertain or unsupported evidence', async () => {
    const x = io()
    x.evaluate
      .mockReset()
      .mockResolvedValueOnce(pick({ action: 'search', source: 's' }))
      .mockResolvedValueOnce(pick({ action: 'read', source: 'r' }))
      .mockResolvedValueOnce(pick({ action: 'answer', passage: 'e0' }))
      .mockResolvedValueOnce(pick({ supported: 'yes' }, 0.6))
      .mockResolvedValue(pick({ action: 'stop' }))
    const result = await runResearchLoop(context, x.services, signal())
    expect(result.text).not.toContain('Fusajiro')
    expect(x.evaluate.mock.calls[4][0].rejected).toEqual([evidence])
  })
  it('can choose another article after rejecting evidence', async () => {
    const x = io()
    x.services.plugins[0].candidates = () => [
      {
        id: 'a',
        tool: 'read',
        description: 'Read',
        input: { title: 'A' },
        effect: { read: 'A' },
      },
      {
        id: 'b',
        tool: 'read',
        description: 'Read',
        input: { title: 'B' },
        effect: { read: 'B' },
      },
    ]
    x.execute
      .mockReset()
      .mockResolvedValueOnce({
        evidence: [{ ...evidence, text: 'Nintendo makes video games.' }],
      })
      .mockResolvedValueOnce({ evidence: [evidence] })
    x.evaluate
      .mockReset()
      .mockResolvedValueOnce(pick({ action: 'read', source: 'a' }))
      .mockResolvedValueOnce(pick({ action: 'answer', passage: 'e0' }))
      .mockResolvedValueOnce(pick({ supported: 'no' }))
      .mockResolvedValueOnce(pick({ action: 'read', source: 'b' }))
      .mockResolvedValueOnce(pick({ action: 'answer', passage: 'e0' }))
      .mockResolvedValueOnce(pick({ supported: 'yes' }))
    expect(
      (await runResearchLoop(context, x.services, signal())).text,
    ).toContain('Fusajiro')
    expect(x.execute).toHaveBeenCalledTimes(2)
  })
  it('removes exhausted and repeated tools from choices', async () => {
    const x = io()
    x.evaluate
      .mockReset()
      .mockResolvedValue(pick({ action: 'search', source: 's' }))
    await runResearchLoop(context, x.services, signal())
    expect(x.execute).toHaveBeenCalledTimes(1)
    expect(x.evaluate.mock.calls[1][1].action.options).not.toHaveProperty(
      'search',
    )
  })
  it('enforces decision budgets even when evidence keeps failing verification', async () => {
    const x = io()
    x.services.plugins[0].candidates = () => [
      {
        id: 'r',
        tool: 'read',
        description: 'Read',
        input: { title: 'Nintendo' },
        effect: { read: 'Nintendo' },
      },
    ]
    x.execute.mockResolvedValue({
      evidence: [
        evidence,
        { ...evidence, text: 'Another possible passage.' },
        { ...evidence, text: 'A third possible passage.' },
      ],
    })
    x.evaluate
      .mockReset()
      .mockResolvedValueOnce(pick({ action: 'read', source: 'r' }))
      .mockImplementation(async (_s, q) =>
        q.supported
          ? pick({ supported: 'no' })
          : pick({ action: 'answer', passage: 'e0' }),
      )
    const result = await runResearchLoop(context, x.services, signal())
    expect(result.usage.jevCalls).toBeLessThanOrEqual(8)
    expect(result.text).not.toContain('Fusajiro')
  })
  it('does not allow model escalation under policy or on a source error', async () => {
    const x = io()
    x.evaluate.mockReset().mockResolvedValue(pick({ action: 'model' }))
    expect((await runResearchLoop(context, x.services, signal())).type).toBe(
      'answer',
    )
    expect(x.evaluate.mock.calls[0][1].action.options).not.toHaveProperty(
      'model',
    )
    const y = io()
    y.execute.mockRejectedValue(new Error('Source failed'))
    await expect(
      runResearchLoop({ ...context, modelAllowed: true }, y.services, signal()),
    ).rejects.toThrow('Source failed')
    expect(y.evaluate).toHaveBeenCalledOnce()
  })
  it('only hands off to a model after an explicit allowed selection', async () => {
    const x = io()
    x.evaluate.mockReset().mockResolvedValue(pick({ action: 'model' }))
    expect(
      (
        await runResearchLoop(
          { ...context, modelAllowed: true },
          x.services,
          signal(),
        )
      ).type,
    ).toBe('model')
  })
  it('stops canceled and uncertain runs before tool execution', async () => {
    const x = io()
    const abort = new AbortController()
    abort.abort()
    await expect(
      runResearchLoop(context, x.services, abort.signal),
    ).rejects.toThrow('Stopped')
    expect(x.evaluate).not.toHaveBeenCalled()
    x.evaluate
      .mockReset()
      .mockResolvedValue(pick({ action: 'search', source: 's' }, Number.NaN))
    await runResearchLoop(context, x.services, signal())
    expect(x.execute).not.toHaveBeenCalled()
  })
})
