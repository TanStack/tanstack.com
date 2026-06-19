import assert from 'node:assert/strict'
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createLocalBuilderManifestBundleFromFiles } from '../src/builder/manifest'
import type { CompileResponse, ProjectDefinition } from '../src/builder/api'

const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY
const originalCwd = process.cwd()
const originalFakePnpmLog = process.env.FORGE_FAKE_PNPM_LOG
const originalFakePnpmRelease = process.env.FORGE_FAKE_PNPM_RELEASE
const originalOpenAiApiKey = process.env.OPENAI_API_KEY
const originalPath = process.env.PATH
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-validation-blocks-run-'),
)
const fakeBinDir = path.join(runtimeRoot, 'bin')
const fakePnpmPath = path.join(fakeBinDir, 'pnpm')
const fakePnpmLogPath = path.join(runtimeRoot, 'pnpm.log')
const fakePnpmReleasePath = path.join(runtimeRoot, 'pnpm.release')

delete process.env.ANTHROPIC_API_KEY
delete process.env.OPENAI_API_KEY
process.chdir(runtimeRoot)

let validationPromise: Promise<unknown> | undefined

try {
  await mkdir(fakeBinDir, { recursive: true })
  await writeFile(
    fakePnpmPath,
    [
      '#!/usr/bin/env sh',
      'printf "%s\\n" "$*" >> "$FORGE_FAKE_PNPM_LOG"',
      'while [ ! -f "$FORGE_FAKE_PNPM_RELEASE" ]; do',
      '  sleep 0.02',
      'done',
      'exit 0',
      '',
    ].join('\n'),
    'utf8',
  )
  await chmod(fakePnpmPath, 0o755)

  process.env.PATH = `${fakeBinDir}${path.delimiter}${originalPath ?? ''}`
  process.env.FORGE_FAKE_PNPM_LOG = fakePnpmLogPath
  process.env.FORGE_FAKE_PNPM_RELEASE = fakePnpmReleasePath

  const { startLocalForgeAgentRun } =
    await import('../src/builder/runtime/local-agent.server')
  const {
    appendLocalForgeManifestTimeline,
    LOCAL_FORGE_PROJECT_ID,
    LOCAL_FORGE_SESSION_ID,
    persistLocalForgeManifestBundle,
    readLocalForgeTimeline,
    resetLocalForgeRuntime,
  } = await import('../src/builder/runtime/local-store.server')
  const { materializeLatestLocalForgeManifest } =
    await import('../src/builder/runtime/local-materialize.server')

  await resetLocalForgeRuntime()

  const files = {
    'package.json': `${JSON.stringify(
      {
        scripts: {
          build: 'vite build',
        },
      },
      null,
      2,
    )}\n`,
    'src/routes/index.tsx':
      "import { createFileRoute } from '@tanstack/react-router'\nexport const Route = createFileRoute('/')({ component: () => null })\n",
  }
  const bundle = await createLocalBuilderManifestBundleFromFiles({
    compile: createCompile(files),
    createdAt: '2026-06-18T00:00:00.000Z',
    definition: {
      featureOptions: {},
      features: [],
      framework: 'react',
      name: 'fixture-app',
      packageManager: 'pnpm',
      tailwind: true,
    } satisfies ProjectDefinition,
    fileSource: 'builder-definition',
    files,
    projectId: LOCAL_FORGE_PROJECT_ID,
    sessionId: LOCAL_FORGE_SESSION_ID,
  })

  await persistLocalForgeManifestBundle(bundle)
  await appendLocalForgeManifestTimeline({
    bundle,
    createdAt: bundle.manifest.createdAt,
    producerId: 'validation-blocks-run-fixture',
    producerKind: 'system',
    runId: undefined,
  })

  validationPromise = materializeLatestLocalForgeManifest()

  await waitForLogLine(fakePnpmLogPath, 'install')

  const timelineBeforeRejectedRun = await readLocalForgeTimeline()

  await assert.rejects(
    startLocalForgeAgentRun({
      clientRequestId: 'validation-blocked-run-request',
      prompt: 'Build while validation is active',
    }),
    /A local Forge workflow is already active\./,
  )
  assert.deepEqual(
    await readLocalForgeTimeline(),
    timelineBeforeRejectedRun,
    'run rejected by active validation must not append input or run events',
  )

  await releaseFakePnpm()
  await validationPromise

  const finalTimeline = await readLocalForgeTimeline()

  assert.equal(
    finalTimeline.some(
      (event) =>
        event.type === 'session.input.received' &&
        event.payload.clientRequestId === 'validation-blocked-run-request',
    ),
    false,
    'blocked run input must never be persisted',
  )
} finally {
  await releaseFakePnpm()

  if (validationPromise) {
    await validationPromise.catch(() => {})
  }

  process.chdir(originalCwd)

  restoreEnvVar('ANTHROPIC_API_KEY', originalAnthropicApiKey)
  restoreEnvVar('FORGE_FAKE_PNPM_LOG', originalFakePnpmLog)
  restoreEnvVar('FORGE_FAKE_PNPM_RELEASE', originalFakePnpmRelease)
  restoreEnvVar('OPENAI_API_KEY', originalOpenAiApiKey)
  restoreEnvVar('PATH', originalPath)

  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge validation blocks run verifier passed')

function createCompile(files: Record<string, string>): CompileResponse {
  return {
    commands: [],
    envVars: [],
    files,
    packages: {
      dependencies: {},
      devDependencies: {},
      scripts: {
        build: 'vite build',
      },
    },
    warnings: [],
  }
}

async function waitForLogLine(filePath: string, expectedText: string) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < 5000) {
    try {
      const content = await readFile(filePath, 'utf8')

      if (content.includes(expectedText)) {
        return
      }
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error
      }
    }

    await delay(10)
  }

  throw new Error(`Timed out waiting for ${expectedText} in ${filePath}`)
}

async function releaseFakePnpm() {
  await writeFile(fakePnpmReleasePath, 'release\n', 'utf8').catch(() => {})
}

function delay(delayMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

function isMissingFileError(error: unknown) {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
