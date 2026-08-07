import assert from 'node:assert/strict'
import { charts } from '../src/libraries/libraries'
import {
  getFrameworkDocsHash,
  getFrameworkDocsPath,
} from '../src/libraries/frameworkSupport'
import type { Framework } from '../src/libraries/types'

const expectedDocsPaths: Partial<Record<Framework, string>> = {
  react: 'framework/react/adapter',
  preact: 'framework/preact/adapter',
  vue: 'framework/vue/adapter',
  solid: 'framework/solid/adapter',
  svelte: 'framework/svelte/adapter',
  angular: 'framework/angular/adapter',
  lit: 'framework/lit/adapter',
  alpine: 'framework/alpine/adapter',
  octane: 'framework/octane/adapter',
  vanilla: 'quick-start',
} as const

assert.deepEqual(charts.frameworks, Object.keys(expectedDocsPaths))

for (const framework of charts.frameworks) {
  assert.equal(
    getFrameworkDocsPath(framework, charts),
    expectedDocsPaths[framework],
  )
  assert.equal(getFrameworkDocsHash(framework, charts), undefined)
}

console.log('charts framework support tests passed')
