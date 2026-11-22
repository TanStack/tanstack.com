import { describe, it, expect } from 'vitest'
import { defaultPolicy, type Recipe } from '../../src/chat/core/types'
import {
  enforceModel,
  routeCandidates,
  clarification,
  selectJevRoute,
} from '../../src/chat/core/routing'
import { seal, unseal, hash } from '../../src/chat/server/crypto'
import { validateEndpoint } from '../../src/chat/server/providers'
const recipe: Recipe = {
  id: 'recipe-1',
  workspace_id: 'w',
  title: 'Weekly report',
  description: 'Generate this week’s report with no inputs.',
  code: 'export default async function main(){return 1}',
  created_at: 0,
}
describe('routing boundaries', () => {
  it('advertises exact commands for Jev instead of executing them first', async () => {
    const candidates = await routeCandidates({
      text: '/Weekly report',
      recipes: [recipe],
      policy: defaultPolicy,
    })
    expect(candidates[0].route).toEqual({ type: 'recipe', recipe })
  })
  it('does not advertise Kody when policy denies it', async () => {
    expect(
      await routeCandidates({
        text: 'Who founded Nintendo?',
        recipes: [recipe],
        answerPackage: '@test/answer-question',
        policy: { ...defaultPolicy, allowKody: false },
      }),
    ).toEqual([])
  })
  it('clarifies unknown or uncertain choices instead of falling back to a model', () => {
    const candidates = [
      {
        id: 'recipe',
        description: '',
        route: { type: 'recipe' as const, recipe },
      },
    ]
    expect(selectJevRoute('invented', 1, candidates)).toEqual(clarification)
    expect(selectJevRoute('recipe', 0.7, candidates)).toEqual(clarification)
    expect(selectJevRoute('recipe', NaN, candidates)).toEqual(clarification)
    expect(selectJevRoute('recipe', 0.95, candidates)).toEqual({
      type: 'recipe',
      recipe,
    })
  })
  it('cannot enter a model or arbitrary recipe under a no-model restriction', () => {
    const candidates = [
      { id: 'model', description: '', route: { type: 'model' as const } },
      {
        id: 'recipe',
        description: '',
        route: { type: 'recipe' as const, recipe },
      },
    ]
    expect(selectJevRoute('model', 1, candidates, true).type).toBe('answer')
    expect(selectJevRoute('recipe', 1, candidates, true).type).toBe('answer')
    expect(() =>
      enforceModel(
        { ...defaultPolicy, allowChatModels: false },
        'included',
        'model',
      ),
    ).toThrow()
  })
  it('enforces provider and model independently', () => {
    expect(() =>
      enforceModel(
        { ...defaultPolicy, allowedProviders: ['included'] },
        'openai',
        'gpt',
      ),
    ).toThrow()
    expect(() =>
      enforceModel(
        { ...defaultPolicy, allowedModels: ['approved'] },
        'included',
        'other',
      ),
    ).toThrow()
    expect(() =>
      enforceModel(
        { ...defaultPolicy, allowedModels: ['approved'] },
        'included',
        'approved',
      ),
    ).not.toThrow()
  })
  it('supports custom candidate plugins without executing routes', async () => {
    const result = await routeCandidates(
      { text: 'hello', recipes: [], policy: defaultPolicy },
      [
        { id: 'skip', description: '', candidates: async () => [] },
        {
          id: 'answer',
          description: '',
          candidates: async () => [
            {
              id: 'hello',
              description: 'Greeting',
              route: { type: 'answer', text: 'hello' },
            },
          ],
        },
      ],
    )
    expect(result[0].id).toBe('hello')
  })
})
describe('credential encryption', () => {
  const key = 'a'.repeat(48)
  it('encrypts, randomizes, and authenticates stored credentials', async () => {
    const a = await seal({ secret: 'test-value' }, key)
    const b = await seal({ secret: 'test-value' }, key)
    expect(a).not.toContain('test-value')
    expect(a).not.toBe(b)
    expect(await unseal(a, key)).toEqual({ secret: 'test-value' })
    await expect(unseal(a, 'b'.repeat(48))).rejects.toThrow()
  })
  it('rejects an unconfigured encryption key', async () => {
    await expect(seal({}, '')).rejects.toThrow()
  })
  it('produces URL-safe PKCE challenges', async () => {
    expect(await hash('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })
})
describe('custom endpoint validation', () => {
  it.each([
    'http://example.com',
    'https://127.0.0.1',
    'https://localhost',
    'https://service.internal',
    'https://user:pass@example.com',
    'https://[::1]',
    'https://example.com:8000',
    'https://example.com?key=secret',
  ])('rejects %s', (url) => expect(() => validateEndpoint(url)).toThrow())
  it('accepts a public HTTPS API URL', () =>
    expect(validateEndpoint('https://api.example.com/v1/')).toBe(
      'https://api.example.com/v1',
    ))
})
