import assert from 'node:assert/strict'
import test from 'node:test'
import { createExampleSandboxDocument } from '../src/utils/example-sandbox.client'

test('keeps fragment links inside the sandbox document', () => {
  const document = createExampleSandboxDocument({
    compiled: {
      css: '',
      imports: {},
      javascript: '',
    },
    document: undefined,
    entry: '/src/main.ts',
    files: { '/src/main.ts': '' },
    runToken: 'test-run',
    theme: 'light',
  })

  assert.match(document, /href\?\.startsWith\('#'\)/)
  assert.match(document, /event\.preventDefault\(\)/)
  assert.match(document, /target\?\.scrollIntoView\(\)/)
})
