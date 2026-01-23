/**
 * Lightweight smoke tests using fetch - no browser required
 * Verifies pages return 200 and contain expected content
 *
 * Prerequisites:
 * - Dev server running on :3000 (or will start one)
 * - Library repos cloned as siblings (query, router, table, etc.)
 *   Dev mode reads docs from local filesystem: ../../../../{repo}
 *
 * Skipped in CI because:
 * - No standalone production server (Netlify serverless deployment)
 * - Library repos not available as siblings
 */

import { spawn, type ChildProcess } from 'child_process'
import { createServer } from 'net'

const DEFAULT_URL = 'http://localhost:3000'

// Skip in CI - this app deploys to Netlify serverless, no standalone server
if (process.env.CI === 'true') {
  console.log('Skipping smoke tests in CI (Netlify serverless deployment)')
  process.exit(0)
}

type TestCase = {
  name: string
  path: string
  expectedContent: string[]
}

const tests: TestCase[] = [
  {
    name: 'home page',
    path: '/',
    expectedContent: ['TanStack', '<html', '</html>'],
  },
  {
    name: 'query docs',
    path: '/query/latest/docs/framework/react/overview',
    expectedContent: ['<html', '</html>', '<h1'],
  },
  {
    name: 'router docs',
    path: '/router/latest/docs/framework/react/overview',
    expectedContent: ['<html', '</html>', '<h1'],
  },
  {
    name: 'table docs',
    path: '/table/latest/docs/introduction',
    expectedContent: ['<html', '</html>', '<h1'],
  },
]

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        reject(new Error('Failed to get port'))
      }
    })
    server.on('error', reject)
  })
}

async function runTest(
  baseUrl: string,
  test: TestCase,
): Promise<{ pass: boolean; error?: string }> {
  try {
    const url = `${baseUrl}${test.path}`
    const response = await fetch(url, {
      headers: { Accept: 'text/html' },
    })

    if (!response.ok) {
      return { pass: false, error: `HTTP ${response.status}` }
    }

    const html = await response.text()

    for (const content of test.expectedContent) {
      if (!html.includes(content)) {
        return { pass: false, error: `Missing expected content: "${content}"` }
      }
    }

    return { pass: true }
  } catch (err) {
    return {
      pass: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function waitForServer(url: string, timeout = 60000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { method: 'HEAD' })
      if (res.ok) return true
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function checkExistingServer(): Promise<boolean> {
  try {
    const res = await fetch(DEFAULT_URL)
    if (!res.ok) return false
    const html = await res.text()
    return html.includes('TanStack')
  } catch {
    return false
  }
}

async function main() {
  let serverProcess: ChildProcess | null = null
  let baseUrl = DEFAULT_URL

  const existingServer = await checkExistingServer()
  if (existingServer) {
    console.log('Using existing server on :3000\n')
  } else {
    const port = await getAvailablePort()
    baseUrl = `http://localhost:${port}`

    console.log(`Starting dev server on port ${port}...`)
    serverProcess = spawn('pnpm', ['dev'], {
      stdio: 'ignore',
      detached: true,
      shell: true,
      env: { ...process.env, PORT: String(port) },
    })

    const ready = await waitForServer(baseUrl)
    if (!ready) {
      console.error('Server failed to start within timeout')
      serverProcess.kill()
      process.exit(1)
    }
    console.log('Server ready\n')
  }

  console.log(`Running smoke tests against ${baseUrl}\n`)

  let passed = 0
  let failed = 0

  for (const test of tests) {
    const result = await runTest(baseUrl, test)
    if (result.pass) {
      console.log(`  ✓ ${test.name}`)
      passed++
    } else {
      console.log(`  ✗ ${test.name}: ${result.error}`)
      failed++
    }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`)

  if (serverProcess) {
    process.kill(-serverProcess.pid!, 'SIGTERM')
  }

  if (failed > 0) {
    process.exit(1)
  }
}

main()
