import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const base =
  process.env.DASHBOARD_URL || 'http://127.0.0.1:3211/examples/dashboard'
const results = []
try {
  for (const kit of ['native', 'material', 'shadcn'])
    for (const source of ['server', 'client']) {
      const page = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
      })
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(
        `${base}?kit=${kit}&source=${source}&borough=Queens&day=1`,
        { timeout: 120000 },
      )
      await page
        .getByRole('table', { name: 'Trip data grid' })
        .waitFor({ timeout: 120000 })
      const table = page.getByRole('table', { name: 'Trip data grid' })
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid=trip-count]')?.textContent ===
          '230',
      )
      await page.getByRole('button', { name: 'Next page', exact: true }).click()
      await page.waitForFunction(
        () =>
          document
            .querySelector('tbody tr[aria-rowindex]')
            ?.getAttribute('aria-rowindex') === '52',
      )
      assert.equal(await table.getAttribute('aria-rowcount'), '231')
      const first = table.locator('td[data-grid-column=zone]').first()
      await first.focus()
      await page.keyboard.press('Control+End')
      await page.waitForFunction(
        () =>
          document.activeElement?.getAttribute('aria-rowindex') === '101' ||
          document.activeElement?.parentElement?.getAttribute(
            'aria-rowindex',
          ) === '101',
      )
      await page.keyboard.press('Control+Home')
      await page.waitForFunction(
        () =>
          document.activeElement?.parentElement?.getAttribute(
            'aria-rowindex',
          ) === '52',
      )
      await page
        .getByRole('separator', { name: 'Resize Trip ID', exact: true })
        .press('ArrowRight')
      await page
        .getByRole('checkbox', { name: 'Select page trips', exact: true })
        .check()
      await page
        .getByRole('button', { name: 'Reset grid', exact: true })
        .click()
      await page.waitForFunction(
        () =>
          document
            .querySelector('[aria-label="Resize Trip ID"]')
            ?.getAttribute('aria-valuenow') === '100',
      )
      assert.equal(
        await page
          .getByRole('checkbox', { name: 'Select page trips', exact: true })
          .isChecked(),
        false,
      )
      await page
        .getByRole('searchbox', { name: 'Search trip records' })
        .fill('Forest')
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid=trip-count]')?.textContent ===
          '43',
      )
      const downloadPromise = page.waitForEvent('download')
      await page
        .getByRole('button', { name: 'Export CSV', exact: true })
        .click()
      const download = await downloadPromise
      assert.equal(await download.failure(), null)
      const stream = await download.createReadStream()
      let csv = ''
      for await (const chunk of stream) csv += chunk.toString()
      assert.equal(csv.trim().split('\r\n').length, 44)
      await page
        .getByRole('button', { name: 'Reset grid', exact: true })
        .click()
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid=trip-count]')?.textContent ===
          '230',
      )
      const group = page.getByRole('combobox', {
        name: 'Group by',
        exact: true,
      })
      if (await group.evaluate((element) => element.tagName === 'SELECT'))
        await group.selectOption('day')
      else {
        await group.click()
        await page.getByRole('option', { name: 'Day', exact: true }).click()
      }
      await page.waitForFunction(
        () => document.querySelector('tr[data-grouped="true"]') !== null,
      )
      if (source === 'server')
        await page.getByTitle('View trips in this group').click()
      else
        await page
          .locator('button.grid-group[aria-expanded=false]')
          .first()
          .click()
      await page.waitForFunction(
        () =>
          document.querySelector('tbody [data-grid-column=id] button') !== null,
      )
      assert.deepEqual(errors, [])
      results.push({ kit, source, passed: true })
      console.log(JSON.stringify(results.at(-1)))
      await page.close()
    }
  const recovery = await browser.newPage()
  await recovery.route('**/*', (route) =>
    route.request().method() === 'POST'
      ? route.abort('failed')
      : route.continue(),
  )
  await recovery.goto(`${base}?kit=native&source=server`, { timeout: 120000 })
  await recovery
    .getByRole('button', { name: 'Retry', exact: true })
    .waitFor({ timeout: 60000 })
  await recovery.unroute('**/*')
  await recovery.getByRole('button', { name: 'Retry', exact: true }).click()
  await recovery
    .getByRole('table', { name: 'Trip data grid' })
    .waitFor({ timeout: 60000 })
  await recovery.context().setOffline(true)
  await recovery.getByRole('button', { name: /^Miles/ }).click()
  await recovery
    .getByText('Offline. Showing cached results until the connection returns.')
    .waitFor()
  await recovery.context().setOffline(false)
  await recovery.waitForFunction(
    () => !document.body.innerText.includes('Offline. Showing cached'),
  )
  await recovery.close()
  console.log(JSON.stringify({ recovery: true, offline: true }))
} finally {
  await browser.close()
}
