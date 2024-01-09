import { unstable_vitePlugin as remix } from '@remix-run/dev'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { cjsInterop } from 'vite-plugin-cjs-interop'

export default defineConfig({
  plugins: [
    remix(),
    tsconfigPaths(),
    cjsInterop({ dependencies: ['@docsearch/react'] }) as any,
  ],
})
