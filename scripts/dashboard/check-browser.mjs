import { chromium } from 'playwright-core'
import { readFile, writeFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const snapshot = JSON.parse(
  await readFile('public/data/dashboard/green-2025-week1.v1.json', 'utf8'),
)
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  })
  const errors = []
  let requests = 0
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (request.url().includes('green-2025-week1.v1.json')) requests++
  })
  await page.goto(
    process.env.DASHBOARD_URL || 'http://127.0.0.1:3210/examples/dashboard',
    { timeout: 120000 },
  )
  const count = page.getByTestId('trip-count')
  const checkCount = async (value) => {
    await page.waitForFunction(
      (expected) =>
        document.querySelector('[data-testid=trip-count]')?.textContent ===
        expected,
      value.toLocaleString('en-US'),
    )
  }
  await checkCount(8936)
  assert.equal(
    (await page.locator('.dash-analysis-grid svg').count()) >= 3,
    true,
  )
  assert.equal((await page.locator('tr[aria-rowindex]').count()) < 40, true)
  assert.equal(
    await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .some((r) => r.name.includes('MaterialSkin')),
    ),
    false,
  )
  await page.getByRole('button', { name: /^Filter January 2,/ }).click()
  await checkCount(1408)
  await page.goBack()
  await checkCount(8936)
  await page.goForward()
  await checkCount(1408)
  await page
    .getByRole('button', { name: 'Filter zone East Harlem North', exact: true })
    .click()
  const zoneId = snapshot.zones.find(
    (zone) => zone.name === 'East Harlem North',
  ).id
  const reference = snapshot.trips.filter(
    (trip) => trip.day === 2 && trip.zoneId === zoneId,
  )
  await checkCount(reference.length)
  assert.equal(
    await page.getByTestId('fare-total').innerText(),
    (
      reference.reduce((sum, trip) => sum + trip.fareCents, 0) / 100
    ).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
  )
  await page
    .getByRole('button', { name: /^Select trip/ })
    .first()
    .click()
  await page.getByRole('complementary', { name: /^Details for trip/ }).waitFor()
  const selectedId = new URL(page.url()).searchParams.get('selected')
  await page
    .getByRole('combobox', { name: 'Components', exact: true })
    .selectOption('material')
  await page.locator('.MuiTable-root').waitFor()
  assert.equal(
    await count.innerText(),
    reference.length.toLocaleString('en-US'),
  )
  assert.equal(new URL(page.url()).searchParams.get('selected'), selectedId)
  assert.ok((await page.locator('.MuiPaper-root').count()) >= 8)
  const openMaterialMenu = async (name) => {
    await page.getByRole('combobox', { name, exact: true }).click()
    // A transparent menu is still clickable to Playwright. Check the paper's
    // computed opacity so a failed enter transition cannot pass this check.
    await page.waitForFunction(() => {
      const paper = document.querySelector('[role="listbox"]')?.parentElement
      return paper && getComputedStyle(paper).opacity === '1'
    })
  }
  await openMaterialMenu('Appearance')
  await page.getByRole('option', { name: 'Dark', exact: true }).click()
  await page.waitForFunction(
    () =>
      document.querySelector('.dashboard')?.getAttribute('data-appearance') ===
      'dark',
  )
  await page.screenshot({
    path: '/tmp/dashboard-material-dark.png',
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Close trip details', exact: true })
    .click()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await checkCount(8936)
  await openMaterialMenu('Pickup day')
  await page.getByRole('option', { name: 'Jan 1, 2025', exact: true }).click()
  await checkCount(921)
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await checkCount(8936)
  await openMaterialMenu('Pickup borough')
  await page.getByRole('option', { name: 'Queens', exact: true }).click()
  const queens = new Set(
    snapshot.zones
      .filter((zone) => zone.borough === 'Queens')
      .map((zone) => zone.id),
  )
  await checkCount(
    snapshot.trips.filter((trip) => queens.has(trip.zoneId)).length,
  )
  await openMaterialMenu('Components')
  await page
    .getByRole('option', { name: 'shadcn / Base UI', exact: true })
    .click()
  await page.locator('[data-kit="shadcn"] [data-slot="table"]').waitFor()
  await checkCount(1960)
  const openShadcnMenu = async (name) => {
    await page.getByRole('combobox', { name, exact: true }).click()
    await page.waitForFunction(() => {
      const positioner = document.querySelector(
        '.dash-shadcn-positioner:not([hidden])',
      )
      return (
        positioner &&
        getComputedStyle(positioner).opacity === '1' &&
        positioner.getBoundingClientRect().height > 0
      )
    })
  }
  await openShadcnMenu('Pickup day')
  await page.getByRole('option', { name: 'Jan 1, 2025', exact: true }).click()
  await checkCount(230)
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute('aria-label'),
    ),
    'Pickup day',
  )
  await openShadcnMenu('Pickup borough')
  await page.getByRole('option', { name: 'All boroughs', exact: true }).click()
  await checkCount(921)
  await openShadcnMenu('Appearance')
  await page.getByRole('option', { name: 'Light', exact: true }).click()
  await page.waitForFunction(
    () =>
      document.querySelector('.dashboard')?.getAttribute('data-appearance') ===
      'light',
  )
  await page
    .getByRole('combobox', { name: 'Pickup day', exact: true })
    .press('ArrowDown')
  await page.getByRole('listbox').press('Escape')
  await page.waitForFunction(
    () => !document.querySelector('.dash-shadcn-positioner:not([hidden])'),
  )
  await openShadcnMenu('Components')
  await page.getByRole('option', { name: 'Custom', exact: true }).click()
  await checkCount(921)
  await page
    .getByRole('combobox', { name: 'Pickup borough', exact: true })
    .selectOption('Staten Island')
  await page
    .getByRole('combobox', { name: 'Pickup day', exact: true })
    .selectOption('1')
  await checkCount(0)
  await page.getByText('No trips match these filters.').waitFor()
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await checkCount(8936)
  await page
    .getByRole('combobox', { name: 'Appearance', exact: true })
    .selectOption('light')
  await page.getByLabel('Chart height', { exact: true }).fill('250')
  await page.waitForFunction(
    () =>
      document.querySelector('.dash-trend svg')?.getBoundingClientRect()
        .height === 250,
  )
  await page.getByLabel('Chart height', { exact: true }).fill('190')
  // Chart selection uses the public chart surface, not a synthetic callback.
  const chart = page.locator('.dash-trend svg')
  const bounds = await chart.boundingBox()
  assert.ok(bounds)
  await chart.click({ position: { x: 40, y: 120 } })
  await page.waitForFunction(
    () => Number(new URL(location.href).searchParams.get('day')) > 0,
  )
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click()
  await checkCount(8936)
  await page.screenshot({ path: '/tmp/dashboard-desktop.png', fullPage: true })
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.waitForFunction(
      () => document.documentElement.scrollWidth <= innerWidth,
    )
    await page.screenshot({
      path: `/tmp/dashboard-${width}.png`,
      fullPage: true,
    })
  }
  await page
    .getByRole('combobox', { name: 'Components', exact: true })
    .selectOption('material')
  await page.locator('.MuiTable-root').waitFor()
  await page.waitForFunction(
    () => document.documentElement.scrollWidth <= innerWidth,
  )
  await page.screenshot({
    path: '/tmp/dashboard-material-mobile.png',
    fullPage: true,
  })
  assert.equal(requests, 1)
  assert.deepEqual(errors, [])
  const report = {
    browser: await browser.version(),
    requests,
    errors,
    checked: [
      'day and zone filters',
      'chart selection',
      'reference totals',
      'back/forward',
      'selection across component kits',
      'Material panels, table, buttons and selects',
      'all four Material menus reach full opacity before selection',
      'shadcn / Base UI filters, appearance, focus return, keyboard dismissal and kit switching',
      'appearance',
      'empty results',
      'chart resizing',
      '1440/1024/390px layouts',
      'single snapshot request',
    ],
  }
  await writeFile(
    '/tmp/dashboard-redesign-results.json',
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify(report))
} finally {
  await browser.close()
}
