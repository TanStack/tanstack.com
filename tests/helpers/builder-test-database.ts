import assert from 'node:assert/strict'

export function assertBuilderTestDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl)
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol))
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname))
  assert.equal(url.pathname, '/builder_schema_verifier_tests')
  assert.equal(
    url.search,
    '',
    'Test database URL must not override connection options',
  )
}
