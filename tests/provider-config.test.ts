import assert from 'node:assert/strict'
import {
  applyProviderConfig,
  getStartFramework,
} from '../src/utils/provider-config.server'

function createStartFiles(startPackage: string) {
  return {
    'package.json': JSON.stringify({
      dependencies: {
        [startPackage]: 'latest',
      },
      scripts: {
        build: 'vite build',
      },
    }),
    'vite.config.ts': `import { defineConfig } from 'vite'

export default defineConfig({ plugins: [] })
`,
  }
}

const reactFiles = createStartFiles('@tanstack/react-start')
const solidFiles = createStartFiles('@tanstack/solid-start')

assert.equal(getStartFramework(reactFiles), 'react')
assert.equal(getStartFramework(solidFiles), 'solid')
assert.equal(getStartFramework({ 'package.json': '{invalid' }), null)

const reactResult = applyProviderConfig(
  reactFiles,
  'cloudflare',
  'React Example',
)
const solidResult = applyProviderConfig(
  solidFiles,
  'cloudflare',
  'Solid Example',
)

assert.equal(
  (reactResult['wrangler.jsonc'] ?? '').includes(
    '"main": "@tanstack/react-start/server-entry"',
  ),
  true,
)
assert.equal(
  (solidResult['wrangler.jsonc'] ?? '').includes(
    '"main": "@tanstack/solid-start/server-entry"',
  ),
  true,
)
assert.equal(
  (reactResult['wrangler.jsonc'] ?? '').includes(
    '"compatibility_date": "2025-09-02"',
  ),
  true,
)

for (const provider of ['cloudflare', 'netlify', 'railway'] as const) {
  const firstResult = applyProviderConfig(reactFiles, provider, 'React Example')
  const secondResult = applyProviderConfig(
    firstResult,
    provider,
    'React Example',
  )

  assert.deepEqual(
    secondResult,
    firstResult,
    `${provider} provider configuration must be idempotent`,
  )
}

console.log('provider config tests passed')
