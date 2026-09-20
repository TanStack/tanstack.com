import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appCss = readFileSync(
  new URL('../src/styles/app.css', import.meta.url),
  'utf8',
)

test('the global pre rule does not override component text colors', () => {
  const rule = appCss.match(/(?:^|\n)pre\s*\{([^}]*)\}/)

  assert.ok(rule)
  assert.doesNotMatch(rule[1] ?? '', /\btext-black\b|(?:^|[;\s])color\s*:/)
})
