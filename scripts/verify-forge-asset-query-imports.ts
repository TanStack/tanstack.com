import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const originalAnthropicApiKey = process.env.ANTHROPIC_API_KEY
const originalCodexCliPath = process.env.FORGE_CODEX_CLI_PATH
const originalCwd = process.cwd()
const originalEnableCodexCli = process.env.FORGE_ENABLE_CODEX_CLI
const originalHarness = process.env.FORGE_AGENT_HARNESS
const originalOpenAiApiKey = process.env.OPENAI_API_KEY
const originalPath = process.env.PATH
const runtimeRoot = await mkdtemp(
  path.join(os.tmpdir(), 'forge-asset-query-imports-'),
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
      "fs.writeFileSync(path.join(workspaceDir, 'src/routes/__root.tsx'), [",
      '  "import { HeadContent, Scripts, createRootRoute } from \'@tanstack/react-router\'",',
      '  "import appCss from \'../styles.css?url\'",',
      '  "export const Route = createRootRoute({",',
      '  "  head: () => ({ links: [{ rel: \'stylesheet\', href: appCss }] }),",',
      '  "  shellComponent: RootDocument,",',
      '  "})",',
      '  "function RootDocument({ children }: { children: React.ReactNode }) {",',
      '  "  return <html><head><HeadContent /></head><body>{children}<Scripts /></body></html>",',
      '  "}",',
      "].join('\\n') + '\\n')",
      'if (outputPath) {',
      '  fs.mkdirSync(path.dirname(outputPath), { recursive: true })',
      '  fs.writeFileSync(outputPath, JSON.stringify({',
      "    title: 'Asset Query Import',",
      "    summary: 'Updated the root route while preserving the Vite CSS URL import.'",
      '  }))',
      '}',
      '',
    ].join('\n'),
    'utf8',
  )
  await writeFile(
    fakePnpmPath,
    ['#!/usr/bin/env sh', 'exit 0', ''].join('\n'),
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
  const { resetLocalForgeRuntime } =
    await import('../src/builder/runtime/local-store.server')

  await resetLocalForgeRuntime()

  const snapshot = await runLocalForgeAgent({
    clientRequestId: 'asset-query-import',
    prompt: 'Update the root route shell',
  })

  assert.equal(snapshot.latestRun?.status, 'finished')
  assert.match(
    snapshot.files['src/routes/__root.tsx'] ?? '',
    /styles\.css\?url/,
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

console.log('Forge asset query import verifier passed')

function restoreEnvVar(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name]
    return
  }

  process.env[name] = value
}
