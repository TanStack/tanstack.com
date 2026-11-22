import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['harness-tests/core/**/*.test.{ts,js}'],
    environment: 'node',
    maxWorkers: 4,
  },
})
