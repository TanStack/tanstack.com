import fs from 'node:fs'
import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
const origin = 'https://tanstack-perf-stage-site.thetanstack.workers.dev'
const sessions = JSON.parse(fs.readFileSync('.staging/sessions.json', 'utf8'))
;(async () => {
  const browser = await chromium.launch({
    executablePath:
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  })
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    })
    await context.addCookies([
      {
        name: 'session_token',
        value: encodeURIComponent(sessions.users[0].token),
        url: origin,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ])
    const page = await context.newPage(),
      errors = [],
      forbiddenRequests = []
    await page.route('**/*', async (route) => {
      const u = new URL(route.request().url())
      if (
        ['tanstack.com', 'chat.tanstack.com', 'kody.codes'].includes(u.hostname)
      ) {
        forbiddenRequests.push(u.origin + u.pathname)
        await route.abort()
        return
      }
      await route.continue()
    })
    page.on('pageerror', (e) => errors.push(e.message))
    const response = await page.goto(origin + '/account', {
      waitUntil: 'networkidle',
    })
    await page
      .getByRole('heading', { name: 'My Account', exact: true })
      .waitFor()
    assert.equal(response.status(), 200)
    const values = await page
      .locator('input')
      .evaluateAll((inputs) => inputs.map((input) => input.value))
    assert.ok(values.includes('staging-alice@example.invalid'))
    await page.screenshot({ path: '/tmp/tanstack-staging-account.png' })
    await page.getByRole('button', { name: 'Logout', exact: true }).click()
    await page.waitForURL('**/login')
    const signedOut = await context.request.get(
      origin + '/api/chat/account/preferences',
    )
    assert.equal(signedOut.status(), 401)
    assert.deepEqual(errors, [])
    assert.deepEqual(forbiddenRequests, [])
    const result = {
      accountStatus: response.status(),
      signedInUser: 'Staging Alice',
      signedOutStatus: signedOut.status(),
      url: page.url(),
      errors,
      forbiddenRequests,
    }
    fs.writeFileSync(
      'staging/auth-browser.json',
      JSON.stringify(result, null, 2) + '\n',
    )
    console.log(result)
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
