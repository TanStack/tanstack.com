import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defaultPolicy } from '../../src/chat/core/types'
const mocks = vi.hoisted(() => ({ decide: vi.fn(), kody: vi.fn() }))
vi.mock('@tanstack/ai', async (original) => ({
  ...(await original<object>()),
  decide: mocks.decide,
}))
vi.mock('../../src/chat/server/kody', () => ({ kodyCall: mocks.kody }))
import {
  routeRequest,
  modelToolDecision,
} from '../../src/chat/server/jev-router'
import { runKodyAnswer } from '../../src/chat/server/kody-answer'
import { answerResultSchema, formatAnswer } from '../../src/chat/core/answers'
const context = {
  text: 'Who founded Nintendo?',
  recipes: [],
  policy: defaultPolicy,
  answerPackage: '@test/answer-question',
  recentMessages: [],
  purpose: '',
  modelAllowed: true,
}
const env = {
  TYPESAFE_API_KEY: 'test-only-key',
  KODY_ORIGIN: 'https://kody.test',
  ENCRYPTION_KEY: 'test-only-encryption-key-with-more-than-32-characters',
}
const signal = new AbortController().signal
const usage = {
  jevCalls: 2,
  chatModelCalls: 0,
  searches: 1,
  inputTokens: 400,
  outputTokens: 20,
}
const result = {
  version: 1,
  status: 'answered',
  evidence: [
    {
      text: 'Nintendo was founded by Fusajiro Yamauchi.',
      title: 'Nintendo',
      url: 'https://en.wikipedia.org/wiki/Nintendo',
    },
  ],
  usage,
}
beforeEach(() => vi.clearAllMocks())
describe('every-turn Jev routing', () => {
  it.each([
    'Who founded Nintendo?',
    '/Weekly report',
    'hello',
    'Write me a poem',
  ])('consults Jev with no saved actions for %s', async (text) => {
    mocks.decide.mockResolvedValue({
      route: { value: 'kody-answer', probability: 0.99 },
      noChatModels: { value: false },
      meta: { usage: {} },
    })
    expect(
      (await routeRequest({ ...context, text }, env, signal)).route.type,
    ).toBe('kody-answer')
    expect(mocks.decide).toHaveBeenCalledOnce()
  })
  it('stops before inference when the Jev credential is missing', async () => {
    await expect(
      routeRequest(context, { TYPESAFE_API_KEY: '' }, signal),
    ).rejects.toThrow('TypeSafe API key')
    expect(mocks.decide).not.toHaveBeenCalled()
  })
  it('propagates Jev failures with no model fallback', async () => {
    mocks.decide.mockRejectedValue(new Error('Unavailable'))
    await expect(routeRequest(context, env, signal)).rejects.toThrow(
      'Unavailable',
    )
  })
  it('excludes model choice under policy and enforces user restrictions', async () => {
    mocks.decide.mockResolvedValue({
      route: { value: 'model', probability: 1 },
      noChatModels: { value: true },
      meta: { usage: {} },
    })
    expect((await routeRequest(context, env, signal)).route.type).toBe('answer')
    await routeRequest({ ...context, modelAllowed: false }, env, signal)
    expect(
      mocks.decide.mock.calls[1][0].questions.route.criteria,
    ).not.toHaveProperty('model')
  })
})
describe('model proposals return to Jev', () => {
  const proposal = {
    request: 'Do you have access to Slack?',
    recentMessages: [],
    tool: 'kody_search',
    args: { query: 'Slack connection status' },
    previousResults: [],
  }
  it.each([
    ['proceed', 0.99, true],
    ['stop', 0.99, false],
    ['proceed', 0.79, false],
    ['proceed', NaN, false],
    ['proceed', 1.1, false],
  ])('checks %s at confidence %s', async (value, probability, allowed) => {
    mocks.decide.mockResolvedValue({
      action: { value, probability },
      meta: { usage: {} },
    })
    expect((await modelToolDecision(proposal, env, signal)).allowed).toBe(
      allowed,
    )
    expect(mocks.decide.mock.calls[0][0].state).toMatchObject(proposal)
  })
  it('cannot authorize arbitrary execution or proceed after a decision failure', async () => {
    await expect(
      modelToolDecision({ ...proposal, tool: 'kody_execute' }, env, signal),
    ).rejects.toThrow('unsupported')
    expect(mocks.decide).not.toHaveBeenCalled()
    mocks.decide.mockRejectedValue(new Error('Unavailable'))
    await expect(modelToolDecision(proposal, env, signal)).rejects.toThrow(
      'Unavailable',
    )
  })
})
describe('Kody answer boundary', () => {
  it('passes restrictions and renders source evidence without a chat call', async () => {
    mocks.kody.mockResolvedValue({ structuredContent: { result } })
    const answer = await runKodyAnswer(
      env,
      'user',
      '@test/answer-question',
      context.text,
      signal,
      'run',
    )
    expect(answer.markdown).toContain('Fusajiro Yamauchi')
    expect(mocks.kody.mock.calls[0][3].params.constraints.allowChatModels).toBe(
      false,
    )
    expect(mocks.decide).not.toHaveBeenCalled()
  })
  it('rejects package import injection before calling Kody', async () => {
    await expect(
      runKodyAnswer(
        env,
        'user',
        "@test/answer-question';evil",
        context.text,
        signal,
        'run',
      ),
    ).rejects.toThrow()
    expect(mocks.kody).not.toHaveBeenCalled()
  })
  it('rejects claimed model use and unsourced answers', async () => {
    mocks.kody.mockResolvedValue({
      structuredContent: {
        result: { ...result, usage: { ...usage, chatModelCalls: 1 } },
      },
    })
    await expect(
      runKodyAnswer(
        env,
        'user',
        '@test/answer-question',
        context.text,
        signal,
        'run',
      ),
    ).rejects.toThrow('restriction')
    expect(
      answerResultSchema.safeParse({ ...result, evidence: [] }).success,
    ).toBe(false)
    expect(
      answerResultSchema.safeParse({
        ...result,
        evidence: [{ ...result.evidence[0], url: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false)
  })
  it('renders evidence as text instead of injected markdown', () => {
    const parsed = answerResultSchema.parse({
      ...result,
      evidence: [{ ...result.evidence[0], text: '[click](https://evil.test)' }],
    })
    expect(formatAnswer(parsed)).toContain('\\[click\\]')
  })
})
