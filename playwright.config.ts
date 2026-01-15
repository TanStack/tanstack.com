import { defineConfig } from '@playwright/test'

const port = process.env.PORT || '3000'
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 30000,
  use: {
    baseURL,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  webServer: {
    command: `PORT=${port} pnpm dev`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium', headless: true },
    },
  ],
})
