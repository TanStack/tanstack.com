import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../', import.meta.url))

for (const mode of ['production', 'development']) {
  it(`boots the auth module in a ${mode} Worker and preserves signed sessions across requests`, async () => {
    const bundle = await build({
      absWorkingDir: root,
      stdin: {
        contents: `
          import { getSessionService } from './src/auth/context.server';
          let cookie;
          export default {
            async fetch() {
              const service = getSessionService();
              cookie ??= await service.signCookie({
                userId: 'worker-startup-fixture',
                expiresAt: Date.now() + 60000,
                version: 1,
              });
              return Response.json(await service.verifyCookie(cookie));
            },
          };
        `,
        resolveDir: root,
      },
      bundle: true,
      format: 'esm',
      platform: 'node',
      write: false,
      define: {
        'process.env.NODE_ENV': JSON.stringify(mode),
        'process.env.SESSION_SECRET':
          mode === 'production'
            ? JSON.stringify('worker-fixture-secret')
            : 'undefined',
      },
      plugins: [
        {
          name: 'unused-database',
          setup(builder) {
            builder.onResolve({ filter: /^~\/db\/client$/ }, () => ({
              path: 'database',
              namespace: 'fixture',
            }))
            builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
              contents:
                'export const db = {}; export async function isDatabaseConfigured() { return false }',
            }))
          },
        },
      ],
    })
    const runtime = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: bundle.outputFiles[0].text,
        compatibilityDate: '2026-06-19',
        compatibilityFlags: ['nodejs_compat'],
        cf: false,
        host: '127.0.0.1',
        port: 0,
        inspectorPort: 0,
      }),
    )
    try {
      await runtime.ready
      for (let request = 0; request < 2; request++) {
        const response = await runtime.dispatchFetch('http://localhost/')
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({
          userId: 'worker-startup-fixture',
          version: 1,
        })
      }
    } finally {
      await runtime.dispose()
    }
  })
}
