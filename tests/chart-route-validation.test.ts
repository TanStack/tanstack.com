/// <reference types="node" />

import assert from 'node:assert/strict'
import test from 'node:test'
import { Route } from '../src/routes/stats/npm/$packages'

const schema = Route.options.validateSearch
assert.ok(schema && typeof schema === 'object' && '~standard' in schema)
const standardSchema = schema['~standard']

test('npm comparison route preserves binType search validation', async () => {
  const defaultResult = await standardSchema.validate({})
  assert.equal(defaultResult.issues, undefined)
  assert.equal(defaultResult.value.binType, 'weekly')

  for (const binType of ['yearly', 'monthly', 'weekly', 'daily']) {
    const result = await standardSchema.validate({ binType })
    assert.equal(result.issues, undefined)
    assert.equal(result.value.binType, binType)
  }
})

test('npm comparison route defaults invalid binType search values', async () => {
  const result = await standardSchema.validate({ binType: 'hourly' })
  assert.equal(result.issues, undefined)
  assert.equal(result.value.binType, 'weekly')
})
