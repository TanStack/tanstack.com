import assert from 'node:assert/strict'
import {
  createLocalBuilderManifestBundleFromFiles,
  createLocalBuilderManifestBundleFromManifestFiles,
  getLocalManifestFiles,
  summarizeLocalManifestChanges,
} from '../src/builder/manifest'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'
import type { BuilderFileSource } from '../src/builder/schema'

const definition = {
  featureOptions: {},
  features: [],
  framework: 'react',
  name: 'fixture-app',
  packageManager: 'pnpm',
  tailwind: true,
} satisfies ProjectDefinition

const compile = {
  commands: [],
  envVars: [],
  files: {},
  packages: {
    dependencies: {},
    devDependencies: {},
    scripts: {},
  },
  warnings: [],
} satisfies CompileResponse

const parentFiles = {
  'README.md': 'old readme\n',
  'src/index.ts': ['one', 'two', 'three', ''].join('\n'),
  'src/old.ts': 'remove me\n',
}
const parentBundle = await createLocalBuilderManifestBundleFromFiles({
  compile: {
    ...compile,
    files: parentFiles,
  },
  createdAt: '2026-06-18T00:00:00.000Z',
  definition,
  fileSource: 'builder-definition',
  files: parentFiles,
  projectId: 'fixture-project',
  sessionId: 'fixture-session',
})

const childFiles = {
  'README.md': 'old readme\n',
  'src/index.ts': ['zero', 'one', 'three', 'four', ''].join('\n'),
  'src/new.ts': ['new one', 'new two', ''].join('\n'),
}
const fileSources: Record<string, BuilderFileSource> = {
  'README.md': 'builder-definition',
  'src/index.ts': 'agent',
  'src/new.ts': 'agent',
}
const childBundle = await createLocalBuilderManifestBundleFromManifestFiles({
  createdAt: '2026-06-18T00:00:01.000Z',
  createdByRunId: 'fixture-run',
  fileSource: 'agent',
  fileSources,
  files: childFiles,
  manifest: parentBundle.manifest,
})
const summary = summarizeLocalManifestChanges({
  files: getLocalManifestFiles(childBundle),
  manifest: childBundle.manifest,
  parentFiles: getLocalManifestFiles(parentBundle),
  parentManifest: parentBundle.manifest,
})

assert.equal(summary.changedFileCount, 3)
assert.equal(summary.additions, 4)
assert.equal(summary.deletions, 2)
assert.equal(
  summary.parentManifestVersionId,
  parentBundle.manifest.manifestVersionId,
)
assert.equal(summary.manifestVersionId, childBundle.manifest.manifestVersionId)

const changesByPath = new Map<string, (typeof summary.files)[number]>()

for (const change of summary.files) {
  changesByPath.set(change.path, change)
}

assert.equal(changesByPath.get('README.md'), undefined)
assert.deepEqual(changesByPath.get('src/index.ts'), {
  additions: 2,
  deletions: 1,
  diffLines: [
    {
      content: 'zero',
      kind: 'added',
      newLineNumber: 1,
    },
    {
      content: 'one',
      kind: 'context',
      newLineNumber: 2,
      oldLineNumber: 1,
    },
    {
      content: 'two',
      kind: 'deleted',
      oldLineNumber: 2,
    },
    {
      content: 'three',
      kind: 'context',
      newLineNumber: 3,
      oldLineNumber: 3,
    },
    {
      content: 'four',
      kind: 'added',
      newLineNumber: 4,
    },
  ],
  path: 'src/index.ts',
  previousSource: 'builder-definition',
  source: 'agent',
  status: 'modified',
})
assert.deepEqual(changesByPath.get('src/new.ts'), {
  additions: 2,
  deletions: 0,
  diffLines: [
    {
      content: 'new one',
      kind: 'added',
      newLineNumber: 1,
    },
    {
      content: 'new two',
      kind: 'added',
      newLineNumber: 2,
    },
  ],
  path: 'src/new.ts',
  previousSource: undefined,
  source: 'agent',
  status: 'added',
})
assert.deepEqual(changesByPath.get('src/old.ts'), {
  additions: 0,
  deletions: 1,
  diffLines: [
    {
      content: 'remove me',
      kind: 'deleted',
      oldLineNumber: 1,
    },
  ],
  path: 'src/old.ts',
  previousSource: 'builder-definition',
  source: 'builder-definition',
  status: 'deleted',
})

console.log('Forge manifest change verifier passed')
