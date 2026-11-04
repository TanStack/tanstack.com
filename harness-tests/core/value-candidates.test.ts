import { expect, it } from 'vitest'
import {
  collectGroundedValues,
  candidatesForSchema,
} from '../../src/chat/server/value-candidates'
it('retains exact request spans, numeric values, and observation provenance', () => {
  const pool = collectGroundedValues(
    'Find "project delta" and return 12 records',
    [
      {
        id: 'lookup',
        value: { items: [{ id: 'P-77', label: 'Project delta' }] },
      },
    ],
  )
  expect(
    pool.values.find((v) => v.value === 'project delta')?.source.kind,
  ).toBe('request')
  expect(pool.values.find((v) => v.value === 12)?.source.path).toMatch(
    /^number-at:/,
  )
  expect(pool.values.find((v) => v.value === 'P-77')?.source).toEqual({
    kind: 'observation',
    id: 'lookup',
    path: '/items/0/id',
  })
  expect(pool.values.some((v) => v.value === 'invented-id')).toBe(false)
})
it('validates constraints before offering values and keeps schema values separate', () => {
  const pool = collectGroundedValues('Use 12 records', [])
  expect(
    candidatesForSchema({ type: 'integer', minimum: 1, maximum: 10 }, pool),
  ).toEqual([])
  const options = candidatesForSchema(
    { type: 'string', enum: ['open', 'closed'] },
    pool,
  )
  expect(options.map((v) => v.value)).toEqual(['open', 'closed'])
  expect(options.every((v) => v.source.kind === 'schema')).toBe(true)
})

it('offers exact punctuation-bounded text without replacing literal punctuation', () => {
  const request = 'Name it Orion. Set date 2026-10-11. Post "Ship it!"'
  const pool = collectGroundedValues(request, [])
  for (const value of [
    'Orion',
    'Orion.',
    '2026-10-11',
    '2026-10-11.',
    'Ship it!',
  ]) {
    const candidate = pool.values.find((item) => item.value === value)!
    expect(candidate).toBeDefined()
    const [, from, to] = /^characters:(\d+):(\d+)$/.exec(candidate.source.path)!
    expect(request.slice(Number(from), Number(to))).toBe(value)
  }
  expect(
    collectGroundedValues('Use P-17, and -1.5.', []).values.some(
      (item) => item.value === 'P-17',
    ),
  ).toBe(true)
  const identifiers = collectGroundedValues(
    'Use -1.5, /archive/ and _name_.',
    [],
  ).values
  expect(identifiers.some((item) => item.value === '-1.5')).toBe(true)
  expect(identifiers.some((item) => item.value === '1.5')).toBe(false)
  expect(identifiers.some((item) => item.value === 'archive')).toBe(false)
  expect(identifiers.some((item) => item.value === 'name')).toBe(false)
})
it('reports bounded or cyclic evidence instead of claiming complete enumeration', () => {
  const cyclic: any = { id: 'safe' }
  cyclic.self = cyclic
  const result = collectGroundedValues(
    'Read things',
    [{ id: 'result', value: cyclic }],
    { maxValues: 5, maxDepth: 2, maxValueBytes: 100 },
  )
  expect(result.complete).toBe(false)
  expect(result.warnings.some((w) => w.includes('Cyclic'))).toBe(true)
  expect(result.values.length).toBeLessThanOrEqual(5)
})
it('can reuse a whole structured value when the schema matches', () => {
  const pool = collectGroundedValues('Use these items', [
    { id: 'lookup', value: { items: ['a', 'b'] } },
  ])
  const options = candidatesForSchema(
    { type: 'array', items: { type: 'string' }, minItems: 2 },
    pool,
  )
  expect(options).toHaveLength(1)
  expect(options[0].value).toEqual(['a', 'b'])
  expect(options[0].source.path).toBe('/items')
})

it('extracts numeric literals followed by sentence punctuation without changing decimals', () => {
  const pool = collectGroundedValues(
    'Use offset 0. Return 12, with threshold -1.5!',
    [],
  )
  const numbers = pool.values.filter((v) => typeof v.value === 'number')
  expect(numbers.map((v) => v.value)).toEqual([0, 12, -1.5])
  expect(numbers[0]?.source.path).toBe('number-at:11')
  expect(
    collectGroundedValues('Read P-17 and 1,000 items', []).values.some(
      (v) => typeof v.value === 'number',
    ),
  ).toBe(false)
})

it('retains explicit JSON arrays and scalar leaves as request evidence', () => {
  const request =
    'Apply these edits:\n```json\n[{"path":"src/a.ts","content":"line 1\\nline 2"}]\n```'
  const pool = collectGroundedValues(request, [])
  const array = pool.values.find((v) => Array.isArray(v.value))
  expect(array?.value).toEqual([
    { path: 'src/a.ts', content: 'line 1\nline 2' },
  ])
  expect(array?.source.kind).toBe('request')
  expect(array?.source.path).toMatch(/^characters:\d+:\d+\/json$/)
  expect(
    pool.values.find((v) => v.value === 'line 1\nline 2')?.source.path,
  ).toMatch(/\/json\/0\/content$/)
})

it('does not evaluate code or repair malformed JSON', () => {
  const pool = collectGroundedValues(
    '```json\n[{"a": 1,}]\n```\n```js\n[runCode()]\n```',
    [],
  )
  expect(pool.values.some((v) => Array.isArray(v.value))).toBe(false)
  expect(pool.warnings).toContain('Explicit JSON could not be parsed.')
})

it('parses a whole JSON request and preserves false and zero', () => {
  const pool = collectGroundedValues(' {"enabled":false,"offset":0} ', [])
  expect(
    pool.values.some((v) => v.value === false && v.source.kind === 'request'),
  ).toBe(true)
  expect(
    pool.values.some((v) => v.value === 0 && v.source.kind === 'request'),
  ).toBe(true)
})

it('offers finite boolean alternatives without treating them as user intent', () => {
  const pool = collectGroundedValues('Include archived records.', [])
  const choices = candidatesForSchema({ type: 'boolean' }, pool)
  expect(choices.map((choice) => choice.value)).toEqual([true, false])
  expect(choices.every((choice) => choice.source.kind === 'schema')).toBe(true)
  expect(
    candidatesForSchema({ type: 'boolean', const: false }, pool).map(
      (choice) => choice.value,
    ),
  ).toEqual([false])
  expect(
    candidatesForSchema(
      { anyOf: [{ type: 'boolean' }, { type: 'null' }] },
      pool,
    ).map((choice) => choice.value),
  ).toEqual([true, false])
  expect(candidatesForSchema({ type: 'number' }, pool)).toEqual([])
})

it('extracts exact URL references from tool text with source offsets', () => {
  const text =
    'Read [the guide](https://example.com/guide) or https://example.com/a_(b)\n'
  const pool = collectGroundedValues('Fetch the guide', [
    { id: 'search', value: { content: [{ type: 'text', text }] } },
  ])
  for (const url of [
    'https://example.com/guide',
    'https://example.com/a_(b)',
  ]) {
    const candidate = pool.values.find((candidate) => candidate.value === url)!
    expect(candidate.source.kind).toBe('observation')
    expect(candidate.source.id).toBe('search')
    expect(candidate.source.path).toBe(
      '/content/0/text/characters:' +
        text.indexOf(url) +
        ':' +
        (text.indexOf(url) + url.length),
    )
  }
  expect(
    pool.values.some(
      (candidate) => candidate.value === 'https://example.com/guide)',
    ),
  ).toBe(false)
})

it('reports oversized text instead of silently dropping its references', () => {
  const pool = collectGroundedValues('Read', [
    { id: 'large', value: 'x'.repeat(64001) + ' https://example.com/guide' },
  ])
  expect(pool.complete).toBe(false)
  expect(pool.warnings).toContain(
    'Text reference extraction exceeds its character budget.',
  )
})

it('offers valid schema defaults as alternatives without coercing invalid defaults', () => {
  const pool = collectGroundedValues('Browse previous tasks.', [])
  const valid = candidatesForSchema({ type: 'string', default: '' }, pool)
  expect(valid.find((candidate) => candidate.id === 'default')).toEqual({
    id: 'default',
    value: '',
    source: { kind: 'schema', id: 'default', path: '' },
  })
  expect(
    candidatesForSchema({ type: 'integer', minimum: 1, default: 0 }, pool).some(
      (candidate) => candidate.id === 'default',
    ),
  ).toBe(false)
})

it('preserves alternate provenance when a cursor equals a record value', () => {
  const pool = collectGroundedValues('Continue the lookup.', [
    { id: 'page', value: { records: [{ sequence: 12 }], nextBefore: 12 } },
  ])
  const values = candidatesForSchema({ type: 'integer' }, pool)
  expect(values).toHaveLength(1)
  expect(values[0]).toMatchObject({
    value: 12,
    source: { id: 'page', path: '/records/0/sequence' },
    otherSources: [{ kind: 'observation', id: 'page', path: '/nextBefore' }],
  })
  expect(pool.values.every((value) => value.otherSources === undefined)).toBe(
    true,
  )
})

it('grounds values inside MCP JSON text blocks and preserves their raw source', () => {
  const text = JSON.stringify({
    records: [{ id: 'item_862', name: 'Quarterly Notes' }],
  })
  const pool = collectGroundedValues('', [
    { id: 'lookup', value: { content: [{ type: 'text', text }] } },
  ])
  expect(pool.values).toContainEqual(
    expect.objectContaining({
      value: 'item_862',
      source: {
        kind: 'observation',
        id: 'lookup',
        path: '/content/0/text/parsed-json/records/0/id',
      },
    }),
  )
  expect(pool.values.some((value) => value.value === text)).toBe(true)
  expect(pool.complete).toBe(true)
})

it('does not extract guessed fields from malformed JSON or ordinary text', () => {
  const pool = collectGroundedValues('', [
    {
      id: 'lookup',
      value: {
        content: [
          { type: 'text', text: 'prefix {"id":"hidden-1"}' },
          { type: 'text', text: '{"id":"hidden-2"' },
          { type: 'image', text: '{"id":"hidden-3"}' },
        ],
      },
    },
  ])
  expect(
    pool.values.some((value) =>
      ['hidden-1', 'hidden-2', 'hidden-3'].includes(String(value.value)),
    ),
  ).toBe(false)
})

it('bounds JSON text decoding without truncating or executing it', () => {
  const pool = collectGroundedValues('', [
    {
      id: 'lookup',
      value: { type: 'text', text: JSON.stringify({ id: 'x'.repeat(64000) }) },
    },
  ])
  expect(pool.complete).toBe(false)
  expect(pool.warnings).toContain(
    'JSON text block exceeds the parsing byte budget.',
  )
})

it('does not include JSON escape backslashes in extracted URLs', () => {
  const text = String.raw`{\"url\":\"https://example.test/guide#section\"}`
  const pool = collectGroundedValues('', [{ id: 'page', value: { text } }])
  const reference = pool.values.find(
    (value) => value.value === 'https://example.test/guide#section',
  )
  expect(reference).toBeDefined()
  expect(
    pool.values.some(
      (value) => value.value === 'https://example.test/guide#section\\',
    ),
  ).toBe(false)
  expect(reference?.source.path).toBe(
    '/text/characters:' +
      text.indexOf('https://') +
      ':' +
      (text.indexOf('https://') + 'https://example.test/guide#section'.length),
  )
})
