/**
 * Lightweight smoke tests using fetch - no browser required
 * Verifies pages return 200 and contain expected content
 *
 * Two clocks:
 * - Local tests (home, blog, ethos, OG images) hit the dev server on :3000 to
 *   validate the commit about to land.
 * - Prod tests (library docs routes) hit https://tanstack.com to sanity-check
 *   routes that depend on sibling repo clones locally — those are too flaky
 *   to test against the dev server, but worth keeping eyes on in production.
 *
 * Skipped in CI because there is no standalone production server (Netlify
 * serverless deployment) and we don't want pre-commit-style network probes
 * running on every PR.
 */

import { spawn, type ChildProcess } from 'child_process'
import { createServer } from 'net'

const DEFAULT_URL = 'http://localhost:3000'
const PROD_URL = 'https://tanstack.com'

// Skip in CI - this app deploys to Netlify serverless, no standalone server
if (process.env.CI === 'true') {
  console.log('Skipping smoke tests in CI (Netlify serverless deployment)')
  process.exit(0)
}

type TestCase = {
  name: string
  path: string
  expectedContent: string[]
  baseUrl?: string
}

type ImageTestCase = {
  name: string
  path: string
  expectStatus?: number // defaults to 200 (image/png check)
}

const tests: TestCase[] = [
  {
    name: 'home page',
    path: '/',
    expectedContent: ['TanStack', '<html', '</html>'],
  },
  {
    name: 'blog index',
    path: '/blog',
    expectedContent: ['<html', '</html>', 'Blog'],
  },
  {
    name: 'blog post',
    path: '/blog/npm-supply-chain-compromise-postmortem',
    expectedContent: ['<html', '</html>', 'Postmortem'],
  },
  {
    name: 'ethos page',
    path: '/ethos',
    expectedContent: ['<html', '</html>', 'Ethos'],
  },
  {
    name: 'query docs (prod)',
    path: '/query/latest/docs/framework/react/overview',
    expectedContent: ['<html', '</html>', '<h1'],
    baseUrl: PROD_URL,
  },
  {
    name: 'router docs (prod)',
    path: '/router/latest/docs/framework/react/overview',
    expectedContent: ['<html', '</html>', '<h1'],
    baseUrl: PROD_URL,
  },
  {
    name: 'table docs (prod)',
    path: '/table/latest/docs/introduction',
    expectedContent: ['<html', '</html>', '<h1'],
    baseUrl: PROD_URL,
  },
]

const ogTests: ImageTestCase[] = [
  { name: 'OG image · library landing', path: '/api/og/query.png' },
  {
    name: 'OG image · docs page',
    path: '/api/og/ai.png?title=useQuery&description=Fetch%20data',
  },
  {
    name: 'OG image · unknown library returns 404',
    path: '/api/og/not-a-library.png',
    expectStatus: 404,
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

  let htmlPassed = 0
  let htmlFailed = 0

  for (const test of tests) {
    const result = await runTest(test.baseUrl ?? baseUrl, test)
    if (result.pass) {
      console.log(`  ✓ ${test.name}`)
      htmlPassed++
    } else {
      console.log(`  ✗ ${test.name}: ${result.error}`)
      htmlFailed++
    }
  }

  console.log(`\nHTML: ${htmlPassed} passed, ${htmlFailed} failed\n`)

  // Test OG image endpoints
  console.log('Running OG image tests...\n')

  let ogPassed = 0
  let ogFailed = 0

  for (const testCase of ogTests) {
    const url = `${baseUrl}${testCase.path}`
    const expectStatus = testCase.expectStatus ?? 200

    try {
      const response = await fetch(url)

      if (response.status !== expectStatus) {
        console.log(
          `  ✗ ${testCase.name}: HTTP ${response.status} (expected ${expectStatus})`,
        )
        ogFailed++
        continue
      }

      // For non-200 expectations, status alone is the assertion.
      if (expectStatus !== 200) {
        console.log(`  ✓ ${testCase.name} (HTTP ${response.status})`)
        ogPassed++
        continue
      }

      const contentType = response.headers.get('content-type')
      if (contentType !== 'image/png') {
        console.log(`  ✗ ${testCase.name}: content-type ${contentType}`)
        ogFailed++
        continue
      }

      const body = await response.arrayBuffer()
      if (body.byteLength === 0) {
        console.log(`  ✗ ${testCase.name}: empty body`)
        ogFailed++
        continue
      }

      console.log(`  ✓ ${testCase.name} (${body.byteLength} bytes)`)
      ogPassed++
    } catch (err) {
      console.log(
        `  ✗ ${testCase.name}: ${err instanceof Error ? err.message : String(err)}`,
      )
      ogFailed++
    }
  }

  console.log(`\nOG: ${ogPassed} passed, ${ogFailed} failed`)
  console.log(
    `Total: ${htmlPassed + ogPassed} passed, ${htmlFailed + ogFailed} failed\n`,
  )

  if (serverProcess) {
    process.kill(-serverProcess.pid!, 'SIGTERM')
  }

  if (htmlFailed + ogFailed > 0) {
    process.exit(1)
  }
}

main()
