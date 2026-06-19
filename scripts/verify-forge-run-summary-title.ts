import assert from 'node:assert/strict'
import { getForgeRunSummaryTitle } from '../src/utils/forge-ui'

assert.equal(
  getForgeRunSummaryTitle({
    changedFileCount: 0,
    hasParentManifest: false,
    statusText: 'Ready',
  }),
  'Ready',
  'unchanged manifests should use the workflow status',
)

assert.equal(
  getForgeRunSummaryTitle({
    changedFileCount: 21,
    hasParentManifest: false,
    statusText: 'Ready',
  }),
  'Created 21 files',
  'baseline manifests without a parent should not claim an agent edited files',
)

assert.equal(
  getForgeRunSummaryTitle({
    changedFileCount: 1,
    hasParentManifest: true,
    statusText: 'Latest run finished',
  }),
  'Edited 1 file',
  'child manifests should use edit language for changed files',
)

console.log('Forge run summary title verifier passed')
