import { expect, it } from 'vitest'
import { SetupEvidence } from '../../src/chat/server/setup-evidence'

it('preserves exact documented links across task serialization without retaining documents or credentials', () => {
  let saved: unknown
  const evidence = new SetupEvidence([], (links) => {
    saved = links
  })
  evidence.register('resource:guide', {
    text: 'Private document text. Connect at https://example.com/connect?provider=notes',
    secret: 'https://example.com/connect?access_token=private',
  })
  const serialized = JSON.stringify(saved)
  expect(serialized).not.toContain('Private document')
  expect(serialized).not.toContain('access_token')
  const resumed = new SetupEvidence(JSON.parse(serialized))
  expect(
    resumed.resolve(
      'resource:guide',
      'https://example.com/connect?provider=notes',
    ),
  ).toBe('https://example.com/connect?provider=notes')
  expect(() =>
    resumed.resolve(
      'resource:guide',
      'https://example.com/connect?provider=other',
    ),
  ).toThrow()
})

it('accepts confirmed execution evidence under its approval reference', () => {
  const evidence = new SetupEvidence()
  evidence.register('approval-id', {
    result: { setupUrl: 'https://example.com/connect' },
  })
  expect(evidence.resolve('approval-id', 'https://example.com/connect')).toBe(
    'https://example.com/connect',
  )
})

it('does not promote relative package paths in prose into setup links', () => {
  const evidence = new SetupEvidence()
  evidence.register(
    'package:slack#list-conversations',
    'Package export — slack / list-conversations',
    'https://kody.codes',
  )
  expect(() =>
    evidence.resolve(
      'package:slack#list-conversations',
      'https://kody.codes/list-conversations',
    ),
  ).toThrow('must come from the inspected documentation')
})

it('accepts an explicit relative setup href from structured evidence', () => {
  const evidence = new SetupEvidence()
  evidence.register(
    'integration:notes',
    { setupHref: '/connect/oauth?provider=notes' },
    'https://kody.codes',
  )
  expect(
    evidence.resolve(
      'integration:notes',
      'https://kody.codes/connect/oauth?provider=notes',
    ),
  ).toBe('https://kody.codes/connect/oauth?provider=notes')
})
