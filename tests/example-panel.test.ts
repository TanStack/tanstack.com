import assert from 'node:assert/strict'
import test from 'node:test'
import { getExamplePanel, getExamplePanels } from '../src/utils/example-panel'
import { getExampleSandboxUrls } from '../src/utils/sandbox'

test('offers both external editors alongside the supported playground', () => {
  assert.deepEqual(getExamplePanels({ hasPlayground: true }), [
    { id: 'playground', label: 'Playground' },
    { id: 'stackblitz', label: 'StackBlitz' },
    { id: 'codesandbox', label: 'CodeSandbox' },
  ])
  assert.deepEqual(
    getExamplePanels({}).map((panel) => panel.id),
    ['code', 'stackblitz', 'codesandbox'],
  )
})

test('preserves legacy sandbox links without selecting unsupported panels', () => {
  const panels = getExamplePanels({})
  assert.equal(getExamplePanel('sandbox', panels), 'stackblitz')
  assert.equal(getExamplePanel('sandbox', panels, 'codesandbox'), 'codesandbox')
  assert.equal(getExamplePanel('codesandbox', panels), 'codesandbox')
  assert.equal(getExamplePanel('playground', panels), undefined)
  assert.equal(getExamplePanel('unknown', panels), undefined)
  const hidden = getExamplePanels({
    hideStackblitzUrl: true,
    hideCodesandboxUrl: true,
  })
  assert.deepEqual(hidden, [{ id: 'code', label: 'Code Explorer' }])
  assert.equal(getExamplePanel('sandbox', hidden), undefined)
})

test('external editors use the same example and encode the selected file', () => {
  const urls = getExampleSandboxUrls({
    repo: 'tanstack/table',
    branch: 'v8',
    examplePath: 'svelte/header-groups',
    file: 'src/a file.svelte',
    isDark: true,
  })
  for (const value of Object.values(urls)) {
    const url = new URL(value)
    assert.ok(
      url.pathname.endsWith(
        '/tanstack/table/tree/v8/examples/svelte/header-groups',
      ),
    )
    assert.equal(url.searchParams.get('file'), 'src/a file.svelte')
    assert.equal(url.searchParams.get('theme'), 'dark')
    assert.equal(url.searchParams.get('embed'), '1')
  }
  assert.equal(new URL(urls.stackBlitzUrl).searchParams.get('preset'), 'node')
})
