import assert from 'node:assert/strict'
import test from 'node:test'
import { assertBuilderTestDatabaseUrl } from './helpers/builder-test-database'

test('Builder destructive fixture only accepts the dedicated local database without overrides', () => {
  assert.doesNotThrow(() =>
    assertBuilderTestDatabaseUrl(
      'postgres://postgres@127.0.0.1:55443/builder_schema_verifier_tests',
    ),
  )
  for (const url of [
    'postgres://postgres@remote.invalid/builder_schema_verifier_tests',
    'postgres://postgres@localhost/production',
    'https://localhost/builder_schema_verifier_tests',
    'postgres://postgres@localhost/builder_schema_verifier_tests?database=production',
    'postgres://postgres@localhost/builder_schema_verifier_tests?options=-c%20search_path%3Dpublic',
  ])
    assert.throws(() => assertBuilderTestDatabaseUrl(url))
})
