import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { z } from 'zod'

const DEFAULT_PORT = 48731
const DEFAULT_TIMEOUT_MS = 1_800_000
const DEFAULT_MAX_OUTPUT_CHARS = 2_000_000
const CODEX_APP_CLI = '/Applications/Codex.app/Contents/Resources/codex'
const IGNORED_DIRECTORIES = new Set([
  '.codex',
  '.git',
  '.tanstack',
  'dist',
  'node_modules',
])

const requestSchema = z.object({
  args: z.array(z.string()),
  command: z.string().min(1),
  cwd: z.string().min(1),
  files: z.record(z.string(), z.string()),
  maxOutputChars: z.number().int().positive().optional(),
  outputLastMessagePath: z.string().min(1),
  prompt: z.string(),
  timeoutMs: z.number().int().positive().optional(),
})

type SidecarRequest = z.infer<typeof requestSchema>

const port = readPositiveIntegerEnv('FORGE_CODEX_SIDECAR_PORT', DEFAULT_PORT)

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, { ok: true })
      return
    }

    if (request.method !== 'POST' || request.url !== '/run') {
      sendJson(response, 404, { error: 'Not found' })
      return
    }

    const payload = requestSchema.parse(
      JSON.parse(await readRequestBody(request)),
    )

    assertAllowedCommand(payload.command)
    assertForgeWorkspacePath(payload.cwd, 'cwd')
    assertForgeWorkspacePath(payload.outputLastMessagePath, 'output path')

    sendJson(response, 200, await runCodex(payload))
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Unknown sidecar error',
    })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.info(`[Forge Codex sidecar] listening on 127.0.0.1:${port}`)
})

async function runCodex(payload: SidecarRequest) {
  const timeoutMs = payload.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxOutputChars = payload.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS
  const command = await resolveCodexCommand(payload.command)
  await prepareWorkspace(payload.cwd, payload.files)
  await mkdir(path.dirname(payload.outputLastMessagePath), { recursive: true })

  return new Promise<{
    exitCode: number | null
    files: Record<string, string>
    finalMessage: string
    stderr: string
    stdout: string
  }>((resolve, reject) => {
    const child = spawn(command, payload.args, {
      cwd: payload.cwd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stderr = ''
    let stdout = ''
    let settled = false
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      finish(new Error(`Codex CLI timed out after ${timeoutMs}ms.`))
    }, timeoutMs)

    child.stdout.on('data', (chunk: Buffer) => {
      stdout = appendLimitedText(stdout, chunk.toString('utf8'), maxOutputChars)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendLimitedText(stderr, chunk.toString('utf8'), maxOutputChars)
    })
    child.once('error', finish)
    child.once('close', (exitCode) => {
      void finish(null, exitCode)
    })
    child.stdin.end(payload.prompt)

    async function finish(error: Error | null, exitCode: number | null = null) {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)

      if (error) {
        reject(error)
        return
      }

      resolve({
        exitCode,
        finalMessage: await readOptionalTextFile(payload.outputLastMessagePath),
        files: await readWorkspaceFiles(payload.cwd),
        stderr,
        stdout,
      })
    }
  })
}

async function prepareWorkspace(
  workspaceDir: string,
  files: Record<string, string>,
) {
  await rm(workspaceDir, { force: true, recursive: true })
  await mkdir(workspaceDir, { recursive: true })

  for (const [filePath, contents] of Object.entries(files)) {
    await writeWorkspaceFile({
      contents,
      filePath,
      workspaceDir,
    })
  }

  await writeWorkspaceFile({
    contents: [
      'packages:',
      '  - .',
      'onlyBuiltDependencies:',
      '  - esbuild',
      '  - lightningcss',
      '',
    ].join('\n'),
    filePath: 'pnpm-workspace.yaml',
    workspaceDir,
  })
}

async function writeWorkspaceFile({
  contents,
  filePath,
  workspaceDir,
}: {
  contents: string
  filePath: string
  workspaceDir: string
}) {
  const outputPath = path.join(workspaceDir, toSafeWorkspacePath(filePath))
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, contents, 'utf8')
}

async function readWorkspaceFiles(workspaceDir: string) {
  const files: Record<string, string> = {}

  for (const filePath of await listWorkspaceFiles(workspaceDir)) {
    files[filePath] = await readFile(
      path.join(workspaceDir, toSafeWorkspacePath(filePath)),
      'utf8',
    )
  }

  return files
}

async function listWorkspaceFiles(workspaceDir: string, basePath = '') {
  const directory = basePath ? path.join(workspaceDir, basePath) : workspaceDir
  const entries = await readdir(directory, { withFileTypes: true })
  const files = Array<string>()

  for (const entry of entries) {
    const filePath = basePath ? `${basePath}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        files.push(...(await listWorkspaceFiles(workspaceDir, filePath)))
      }

      continue
    }

    if (entry.isFile()) {
      files.push(filePath)
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

async function resolveCodexCommand(command: string) {
  if (path.isAbsolute(command)) {
    return command
  }

  if (command === 'codex' && (await pathExists(CODEX_APP_CLI))) {
    return CODEX_APP_CLI
  }

  return command
}

function assertAllowedCommand(command: string) {
  if (command === 'codex' || path.basename(command) === 'codex') {
    return
  }

  throw new Error('Forge Codex sidecar only runs the Codex CLI.')
}

function assertForgeWorkspacePath(value: string, label: string) {
  const normalized = path.resolve(value)

  if (normalized.includes(`${path.sep}tanstack-forge-runtime${path.sep}`)) {
    return
  }

  throw new Error(`Invalid Forge ${label}.`)
}

function toSafeWorkspacePath(filePath: string) {
  const parts = filePath.split('/')

  if (
    !filePath ||
    path.isAbsolute(filePath) ||
    filePath.includes('\\') ||
    parts.some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error(`Unsafe workspace path: ${filePath}`)
  }

  return filePath
}

function appendLimitedText(existing: string, next: string, maxChars: number) {
  const combined = `${existing}${next}`

  return combined.length > maxChars ? combined.slice(-maxChars) : combined
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Array<Buffer> = []

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

async function readOptionalTextFile(filePath: string) {
  try {
    return await readFile(filePath, 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return ''
    }

    throw error
  }
}

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = process.env[name]

  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(payload))
}
