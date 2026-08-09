import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateNotebookLlmsTxt,
  notebookImports,
} from '../src/utils/notebook-environment'

test('exposes the Charts scale package and its subpath imports', () => {
  assert.equal(
    notebookImports['@tanstack/charts-scales'],
    'https://esm.sh/@tanstack/charts-scales@0.7.2',
  )
  assert.equal(
    notebookImports['@tanstack/charts-scales/'],
    'https://esm.sh/@tanstack/charts-scales@0.7.2/',
  )
  assert.match(generateNotebookLlmsTxt(), /@tanstack\/charts-scales/)
})
