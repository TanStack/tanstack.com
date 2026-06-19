import assert from 'node:assert/strict'
import { createLocalBuilderManifestBundleFromFiles } from '../src/builder/manifest'
import { createLocalForgeWorkspaceFromSnapshot } from '../src/builder/runtime/local-agent.server'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { BuilderFileSource } from '../src/builder/schema'
import type { LocalForgeSnapshot } from '../src/builder/runtime/local-store.server'

const definition = {
  featureOptions: {},
  features: [],
  framework: 'react',
  name: 'fixture-app',
  packageManager: 'pnpm',
  tailwind: true,
} satisfies ProjectDefinition

const files = {
  'src/components/agent-card.tsx':
    'export function AgentCard() { return null }\n',
  'src/generated/system.ts': 'export const generated = true\n',
  'src/routes/index.tsx': 'export const Route = null\n',
}
const fileSources = {
  'src/components/agent-card.tsx': 'agent',
  'src/generated/system.ts': 'system',
  'src/routes/index.tsx': 'builder-definition',
} satisfies Record<string, BuilderFileSource>
const compile = {
  commands: [],
  envVars: [],
  files,
  packages: {
    dependencies: {},
    devDependencies: {},
    scripts: {},
  },
  warnings: [],
} satisfies CompileResponse
const bundle = await createLocalBuilderManifestBundleFromFiles({
  compile,
  createdAt: '2026-06-18T00:00:00.000Z',
  definition,
  fileSource: 'builder-definition',
  fileSources,
  files,
  projectId: 'fixture-project',
  sessionId: 'fixture-session',
})
const now = '2026-06-18T00:00:00.000Z'
const snapshot = {
  activeChatId: 'fixture-session',
  agentEvents: [],
  chats: [
    {
      createdAt: now,
      id: 'fixture-session',
      title: 'Workspace provenance verifier',
      updatedAt: now,
    },
  ],
  currentManifest: bundle.manifest,
  devCommand: bundle.manifest.sandbox.devCommand,
  exports: [],
  fileCount: Object.keys(files).length,
  files,
  framework: bundle.manifest.app.framework,
  manifestVersionId: bundle.manifest.manifestVersionId,
  messages: [],
  packageManager: bundle.manifest.app.packageManager,
  stateEventCount: 0,
  timelineEventCount: 0,
  topFiles: Object.keys(files).sort(),
  totalBytes: 0,
  warnings: [],
  workflowEvents: [],
} satisfies LocalForgeSnapshot

const workspace = createLocalForgeWorkspaceFromSnapshot(snapshot)

assert.equal(workspace.get('src/components/agent-card.tsx')?.source, 'agent')
assert.equal(workspace.get('src/generated/system.ts')?.source, 'system')
assert.equal(
  workspace.get('src/routes/index.tsx')?.source,
  'builder-definition',
)

const missingManifestSnapshot = {
  ...snapshot,
  currentManifest: undefined,
} satisfies LocalForgeSnapshot
const fallbackWorkspace = createLocalForgeWorkspaceFromSnapshot(
  missingManifestSnapshot,
)

assert.equal(
  fallbackWorkspace.get('src/components/agent-card.tsx')?.source,
  'builder-definition',
)

console.log('Forge workspace provenance verifier passed')
