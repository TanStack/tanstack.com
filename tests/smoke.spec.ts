import { test, expect } from '@playwright/test'

test.describe('smoke tests', () => {
  test('home page renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
    await expect(page).toHaveTitle(/TanStack/i)
  })

  test('docs page renders', async ({ page }) => {
    await page.goto('/query/latest/docs/overview')
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('h1')).toBeVisible()
  })
})
