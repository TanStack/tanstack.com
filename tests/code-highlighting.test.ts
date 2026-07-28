import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultHighlighter } from '@tanstack/highlight'
import { renderCodeFence } from '@tanstack/highlight/markdown'

test('inline diff notation renders as line decorations', () => {
  const rendered = renderCodeFence(
    {
      code: [
        `- const oldValue = true // [!code --]`,
        `+ const newValue = true // [!code ++]`,
      ].join('\n'),
      lang: 'tsx',
    },
    defaultHighlighter,
  )

  assert.equal(
    rendered.copyText,
    [`- const oldValue = true`, `+ const newValue = true`].join('\n'),
  )
  assert.match(rendered.htmlMarkup, /th-line--deleted/)
  assert.match(rendered.htmlMarkup, /th-line--inserted/)
  assert.doesNotMatch(rendered.htmlMarkup, /!code/)
})
