/**
 * Lightweight smoke tests using fetch - no browser required
 * Verifies pages return 200 and contain expected content
 *
 * Usage:
 *   tsx tests/smoke.ts          # Requires running server
 *   tsx tests/smoke.ts --server # Starts server automatically
 */

import { spawn, type ChildProcess } from 'child_process'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const START_SERVER = process.argv.includes('--server')

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

async function runTest(test: TestCase): Promise<{ pass: boolean; error?: string }> {
  try {
    const url = `${BASE_URL}${test.path}`
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
    return { pass: false, error: err instanceof Error ? err.message : String(err) }
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

async function main() {
  let serverProcess: ChildProcess | null = null

  if (START_SERVER) {
    console.log('Starting dev server...')
    serverProcess = spawn('pnpm', ['dev'], {
      stdio: 'ignore',
      detached: true,
      shell: true,
    })

    const ready = await waitForServer(BASE_URL)
    if (!ready) {
      console.error('Server failed to start within timeout')
      serverProcess.kill()
      process.exit(1)
    }
    console.log('Server ready\n')
  }

  console.log(`Running smoke tests against ${BASE_URL}\n`)

  let passed = 0
  let failed = 0

  for (const test of tests) {
    const result = await runTest(test)
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
    // Kill the server process group
    process.kill(-serverProcess.pid!, 'SIGTERM')
  }

  if (failed > 0) {
    process.exit(1)
  }
}

main()
