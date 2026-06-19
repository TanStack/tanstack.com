import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY
const originalCwd = process.cwd()
const originalCodexCliPath = process.env.FORGE_CODEX_CLI_PATH
const originalEnableCodexCli = process.env.FORGE_ENABLE_CODEX_CLI
const originalHarness = process.env.FORGE_AGENT_HARNESS
const originalOpenAiApiKey = process.env.OPENAI_API_KEY
const originalPath = process.env.PATH
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-codex-scanner-surface-'),
)
const fakeBinDir = path.join(runtimeRoot, 'bin')
const fakeCodexPath = path.join(fakeBinDir, 'codex')
const fakePnpmPath = path.join(fakeBinDir, 'pnpm')

delete process.env.ANTHROPIC_API_KEY
delete process.env.OPENAI_API_KEY
process.chdir(runtimeRoot)

try {
  await mkdir(fakeBinDir, { recursive: true })
  await writeFile(
    fakeCodexPath,
    [
      '#!/usr/bin/env node',
      "const fs = require('node:fs')",
      "const path = require('node:path')",
      'const args = process.argv.slice(2)',
      "let outputPath = ''",
      'let workspaceDir = process.cwd()',
      'for (let index = 0; index < args.length; index += 1) {',
      "  if (args[index] === '-C') workspaceDir = args[index + 1]",
      "  if (args[index] === '-o') outputPath = args[index + 1]",
      '}',
      "const packagePath = path.join(workspaceDir, 'package.json')",
      "const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))",
      "packageJson.scripts = { ...packageJson.scripts, lint: 'echo lint' }",
      'fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\\n`)',
      "fs.writeFileSync(path.join(workspaceDir, 'README.md'), '# Scanner Fixture\\n')",
      "fs.writeFileSync(path.join(workspaceDir, 'src/styles.css'), '@import \"tailwindcss\";\\n.fixture-root { color: red; }\\n')",
      "fs.writeFileSync(path.join(workspaceDir, 'pnpm-workspace.yaml'), 'packages:\\n  - fake\\n')",
      "fs.writeFileSync(path.join(workspaceDir, 'src/routeTree.gen.ts'), 'export const routeTree = \"fake\"\\n')",
      'if (outputPath) {',
      '  fs.mkdirSync(path.dirname(outputPath), { recursive: true })',
      '  fs.writeFileSync(outputPath, JSON.stringify({',
      "    title: 'Scanner Fixture',",
      "    summary: 'Changed root config, docs, and app styles.'",
      '  }))',
      '}',
      'process.stdout.write(JSON.stringify({',
      "  type: 'item.completed',",
      "  item: { id: 'fixture-file-change', type: 'file_change', status: 'completed', changes: [] }",
      "}) + '\\n')",
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    fakePnpmPath,
    [
      '#!/usr/bin/env sh',
      'if [ "$1" = "exec" ] && [ "$2" = "tsc" ]; then',
      '  printf "%s\\n" "fixture typecheck failure" >&2',
      '  exit 1',
      'fi',
      'exit 0',
      '',
    ].join('\n'),
    'utf8',
  )
  await chmod(fakeCodexPath, 0o755)
  await chmod(fakePnpmPath, 0o755)

  process.env.FORGE_AGENT_HARNESS = 'codex-cli'
  process.env.FORGE_ENABLE_CODEX_CLI = 'true'
  process.env.FORGE_CODEX_CLI_PATH = fakeCodexPath
  process.env.PATH = `${fakeBinDir}${path.delimiter}${originalPath ?? ''}`

  const { runLocalForgeAgent } =
    await import('../src/builder/runtime/local-agent.server')
  const { readLocalForgeSnapshot, resetLocalForgeRuntime } =
    await import('../src/builder/runtime/local-store.server')

  await resetLocalForgeRuntime()

  const snapshot = await runLocalForgeAgent({
    clientRequestId: 'codex-scanner-surface',
    prompt: 'Update root files and styles',
  })
  const nextSnapshot = await readLocalForgeSnapshot()
  const packageJson = JSON.parse(snapshot.files['package.json'] ?? '{}')

  assert.equal(snapshot.latestRun?.status, 'finished')
  assert.equal(nextSnapshot.latestRun?.status, 'finished')
  assert.equal(snapshot.files['README.md'], '# Scanner Fixture\n')
  assert.match(snapshot.files['src/styles.css'] ?? '', /fixture-root/)
  assert.equal(packageJson.scripts?.lint, 'echo lint')
  assert.equal(
    snapshot.files['pnpm-workspace.yaml']?.includes('fake') ?? false,
    false,
    'Forge-owned pnpm workspace support must not be captured from Codex',
  )
  assert.notEqual(
    snapshot.files['src/routeTree.gen.ts'],
    'export const routeTree = "fake"\n',
    'system route tree output must not be captured from Codex',
  )
  assert.equal(
    snapshot.workflowEvents.some(
      (event) =>
        event.name === 'workflow.validation.failed' &&
        event.detail?.includes('pnpm exec tsc --noEmit failed'),
    ),
    true,
    'typecheck diagnostics should not fail the agent run',
  )
} finally {
  process.chdir(originalCwd)

  restoreEnvVar('ANTHROPIC_API_KEY', originalAnthropicApiKey)
  restoreEnvVar('FORGE_AGENT_HARNESS', originalHarness)
  restoreEnvVar('FORGE_CODEX_CLI_PATH', originalCodexCliPath)
  restoreEnvVar('FORGE_ENABLE_CODEX_CLI', originalEnableCodexCli)
  restoreEnvVar('OPENAI_API_KEY', originalOpenAiApiKey)
  restoreEnvVar('PATH', originalPath)

  await rm(runtimeRoot, {
    force: true,
    recursive: true,
  })
}

console.log('Forge Codex scanner surface verifier passed')

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
