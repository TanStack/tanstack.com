/// <reference types="node" />
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { compile } from 'tailwindcss'
import { transform } from 'esbuild'

const require = createRequire(import.meta.url)
for (const [name, scope] of [
  ['VisitorChat', '#tanstack-visitor-chat'],
  ['AdminVisitorChats', '.visitor-chat-dock'],
]) {
  test(`${name} cannot override the page's layout utilities when loaded later`, async () => {
    const path = fileURLToPath(
      new URL(`../src/components/visitor-chat/${name}.css`, import.meta.url),
    )
    const compiler = await compile(await readFile(path, 'utf8'), {
      base: dirname(path),
      async loadStylesheet(id, base) {
        const resolved = require.resolve(id, { paths: [base] })
        return {
          path: resolved,
          base: dirname(resolved),
          content: await readFile(resolved, 'utf8'),
        }
      },
    })
    // These classes also control the docs columns and responsive sidebars.
    const utilities = ['block', 'flex', 'flex-1', 'w-full']
    const { code } = await transform(compiler.build(utilities), {
      loader: 'css',
      target: 'chrome100',
      minify: true,
    })
    for (const utility of utilities) {
      assert.ok(code.includes(`${scope} .${utility}{`), code)
      assert.ok(!code.includes(`{.${utility}{`), code)
    }
  })
}
