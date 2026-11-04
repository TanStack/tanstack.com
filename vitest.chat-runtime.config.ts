import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['harness-tests/pending-runtime/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
  },
})
