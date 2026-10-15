import assert from 'node:assert/strict'
import { addOn as reactNetlifyAddOn } from '@tanstack/create/worker-manifest/frameworks/react/add-ons/netlify'
import { addOn as reactRailwayAddOn } from '@tanstack/create/worker-manifest/frameworks/react/add-ons/railway'
import { parseDocument } from 'yaml'
import {
  applyProviderConfig,
  getStartFramework,
} from '../src/utils/provider-config.server'
import type { DeployProvider } from '../src/utils/provider-config.server'

function createStartFiles(
  startPackage: string,
  packageJsonAdditions: Record<string, unknown> = {},
) {
  return {
    'package.json': JSON.stringify({
      dependencies: {
        [startPackage]: 'latest',
      },
      scripts: {
        build: 'vite build',
      },
      ...packageJsonAdditions,
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

const reactPackageManagerResult = applyProviderConfig(
  {
    ...createStartFiles('@tanstack/react-start', {
      packageManager: 'pnpm@11.1.0',
      pnpm: {
        onlyBuiltDependencies: ['esbuild'],
      },
    }),
    'pnpm-lock.yaml': '',
    'pnpm-workspace.yaml': `# Preserve this comment
packages:
  - .
overrides:
  react: 19.2.3
allowBuilds:
  esbuild: true
  sharp: false
`,
  },
  'cloudflare',
  'React Example',
)
const reactCloudflarePackage = JSON.parse(
  reactPackageManagerResult['package.json'] ?? '{}',
)

assert.equal(
  reactCloudflarePackage.devDependencies['@cloudflare/vite-plugin'],
  '^1.26.0',
)
assert.equal(reactCloudflarePackage.devDependencies.wrangler, '^4.70.0')
assert.equal(
  reactCloudflarePackage.scripts.deploy,
  'pnpm run build && wrangler deploy',
)
assert.deepEqual(reactCloudflarePackage.pnpm.onlyBuiltDependencies, [
  'esbuild',
  'sharp',
  'workerd',
])
const reactCloudflareWorkspaceContent =
  reactPackageManagerResult['pnpm-workspace.yaml'] ?? ''
const reactCloudflareWorkspace = parseDocument(reactCloudflareWorkspaceContent)
assert.equal(reactCloudflareWorkspace.errors.length, 0)
assert.equal(reactCloudflareWorkspace.getIn(['allowBuilds', 'esbuild']), true)
assert.equal(reactCloudflareWorkspace.getIn(['allowBuilds', 'sharp']), true)
assert.equal(reactCloudflareWorkspace.getIn(['allowBuilds', 'workerd']), true)
assert.equal(reactCloudflareWorkspace.getIn(['overrides', 'react']), '19.2.3')
assert.match(reactCloudflareWorkspaceContent, /# Preserve this comment/)
assert.match(
  reactPackageManagerResult['vite.config.ts'] ?? '',
  /cloudflare\(\{ viteEnvironment: \{ name: 'ssr' \} \}\)/,
)
assert.deepEqual(
  applyProviderConfig(reactPackageManagerResult, 'cloudflare', 'React Example'),
  reactPackageManagerResult,
)

const newPnpmWorkspaceResult = applyProviderConfig(
  {
    ...createStartFiles('@tanstack/react-start', {
      packageManager: 'pnpm@11.1.0',
    }),
    'pnpm-lock.yaml': '',
  },
  'cloudflare',
  'React Example',
)
const newPnpmWorkspace = parseDocument(
  newPnpmWorkspaceResult['pnpm-workspace.yaml'] ?? '',
)
assert.equal(newPnpmWorkspace.getIn(['allowBuilds', 'sharp']), true)
assert.equal(newPnpmWorkspace.getIn(['allowBuilds', 'workerd']), true)

const solidCloudflareResult = applyProviderConfig(
  solidFiles,
  'cloudflare',
  'Solid Example',
)
const solidCloudflarePackage = JSON.parse(
  solidCloudflareResult['package.json'] ?? '{}',
)
assert.equal(
  solidCloudflarePackage.dependencies['@cloudflare/vite-plugin'],
  '^1.26.0',
)

const netlifyResult = applyProviderConfig(
  reactFiles,
  'netlify',
  'React Example',
)
assert.equal(
  netlifyResult['netlify.toml'],
  reactNetlifyAddOn.files['netlify.toml'],
)

const railwayResult = applyProviderConfig(
  {
    ...createStartFiles('@tanstack/react-start', {
      dependencies: {
        '@tanstack/react-start': 'latest',
        '@sentry/tanstackstart-react': '^10.67.0',
      },
    }),
    'nixpacks.toml': 'legacy config',
  },
  'railway',
  'React Example',
)
const railwayPackage = JSON.parse(railwayResult['package.json'] ?? '{}')
assert.equal(railwayPackage.dependencies.nitro, '3.0.260610-beta')
assert.equal(railwayPackage.scripts.start, 'node .output/server/index.mjs')
assert.equal('nixpacks.toml' in railwayResult, false)

const sentryRailwayResult = applyProviderConfig(
  {
    ...createStartFiles('@tanstack/react-start', {
      dependencies: {
        '@tanstack/react-start': 'latest',
        '@sentry/tanstackstart-react': '^10.67.0',
      },
      scripts: {
        build: 'vite build && cp instrument.server.mjs .output/server',
      },
    }),
    'instrument.server.mjs': 'import * as Sentry from "sentry"',
  },
  'railway',
  'React Example',
)
const sentryRailwayPackage = JSON.parse(
  sentryRailwayResult['package.json'] ?? '{}',
)
assert.equal(
  sentryRailwayPackage.scripts.start,
  'node --import ./.output/server/instrument.server.mjs .output/server/index.mjs',
)
assert.equal(
  (sentryRailwayResult['vite.config.ts'] ?? '').includes(
    reactRailwayAddOn.integrations[0].code,
  ),
  true,
)

const existingNitroResult = applyProviderConfig(
  {
    ...createStartFiles('@tanstack/react-start'),
    'vite.config.ts': `import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

export default defineConfig({ plugins: [nitro()] });
`,
  },
  'railway',
  'React Example',
)
const existingNitroViteConfig = existingNitroResult['vite.config.ts'] ?? ''
assert.equal(
  existingNitroViteConfig.match(/from ['"]nitro\/vite['"]/g)?.length,
  1,
)
assert.equal(
  existingNitroViteConfig.includes(reactRailwayAddOn.integrations[0].code),
  true,
)
assert.equal(/\bnitro\s*\(\s*\)/.test(existingNitroViteConfig), false)

const providers: Array<DeployProvider> = ['cloudflare', 'netlify', 'railway']
for (const provider of providers) {
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
