/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'
import { Route } from '../src/routes/application-starter.index'

const schema = Route.options.validateSearch
assert.ok(schema && typeof schema === 'object' && '~standard' in schema)
const standardSchema = schema['~standard']

test('application starter preserves optional fields and custom feature options', async () => {
  for (const input of [
    {},
    { name: undefined },
    {
      name: '',
      framework: 'react',
      features: 'router,query',
      pm: 'pnpm',
      tailwind: 'false',
      tab: 'preview',
      file: 'src/main.tsx',
      addon: 'query',
      addonFile: 'package.json',
      template: 'custom',
      'query.mode': 'offline',
      custom: { nested: [1, false, null] },
    },
    ...['pnpm', 'npm', 'yarn', 'bun'].map((pm) => ({ pm })),
    ...['summary', 'code', 'preview'].map((tab) => ({ tab })),
  ]) {
    const result = await standardSchema.validate(input)
    assert.equal(result.issues, undefined)
    assert.deepEqual(result.value, input)
  }
})

test('application starter rejects invalid known fields instead of coercing them', async () => {
  for (const input of [
    null,
    [],
    'name=app',
    { pm: 'deno' },
    { tailwind: true },
    { tailwind: 'true' },
    { tab: 'unknown' },
    ...[
      'name',
      'framework',
      'features',
      'pm',
      'tailwind',
      'tab',
      'file',
      'addon',
      'addonFile',
      'template',
    ].flatMap((key) => [null, 0, false, []].map((value) => ({ [key]: value }))),
  ]) {
    const result = await standardSchema.validate(input)
    assert.ok(result.issues?.length, JSON.stringify(input))
  }
})
