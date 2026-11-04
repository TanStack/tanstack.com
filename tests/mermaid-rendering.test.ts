import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

const repoRoot = path.resolve(import.meta.dirname, '..')
const chromePath = [
  process.env.CHROME_BIN,
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  chromium.executablePath(),
].find((candidate) => candidate && existsSync(candidate))
const post = readFileSync(
  path.join(
    repoRoot,
    'src/blog/tanstack-db-1.0-rc1-going-all-in-on-oracles.md',
  ),
  'utf8',
)
const diagram = post.match(/```mermaid\n([\s\S]*?)```/)?.[1]
assert.ok(diagram)

test(
  'Mermaid isolates asynchronous renders, theme changes, errors, and unmounts',
  { skip: chromePath ? false : 'Chrome is not installed', timeout: 60_000 },
  async () => {
    const bundle = await build({
      stdin: {
        contents: `
          import React from 'react'
          import { createRoot } from 'react-dom/client'
          import { MermaidBlock } from './src/components/markdown/MermaidBlock'

          const root = createRoot(document.getElementById('root'))
          window.mermaidTest = { active: 0, configRaces: 0, visibleScratch: 0 }
          window.holdRender = () => {
            window.mermaidTest.gate = new Promise(resolve => {
              window.releaseRender = () => {
                window.mermaidTest.gate = undefined
                resolve()
              }
            })
          }
          window.setDiagrams = codes => root.render(
            React.createElement(React.StrictMode, null,
              codes.map((code, index) => React.createElement(MermaidBlock, { key: index, code }))
            )
          )
          new MutationObserver(() => {
            for (const svg of document.querySelectorAll('body svg')) {
              if (!svg.closest('#root') && getComputedStyle(svg).visibility !== 'hidden') {
                window.mermaidTest.visibleScratch++
              }
            }
          }).observe(document.body, { childList: true, subtree: true })
        `,
        loader: 'tsx',
        resolveDir: repoRoot,
      },
      plugins: [
        {
          name: 'mermaid-render-harness',
          setup(build) {
            // Isolate the renderer from the fallback's unrelated toast providers.
            build.onResolve({ filter: /^\.\/CodeBlockView$/ }, () => ({
              path: 'fallback',
              namespace: 'mermaid-test',
            }))
            build.onResolve({ filter: /^mermaid$/ }, () => ({
              path: 'mermaid',
              namespace: 'mermaid-test',
            }))
            build.onLoad(
              { filter: /.*/, namespace: 'mermaid-test' },
              (args) => ({
                contents:
                  args.path === 'fallback'
                    ? `import React from 'react'
                     export function CodeBlockView({ copyText }) {
                       return React.createElement('pre', null, copyText)
                     }`
                    : `import mermaid from ${JSON.stringify(path.join(repoRoot, 'node_modules/mermaid/dist/mermaid.core.mjs'))}
                     export default {
                       initialize(config) {
                         if (window.mermaidTest.active) window.mermaidTest.configRaces++
                         mermaid.initialize(config)
                       },
                       async render(...args) {
                         window.mermaidTest.active++
                         try {
                           await window.mermaidTest.gate
                           return await mermaid.render(...args)
                         } finally {
                           window.mermaidTest.active--
                         }
                       }
                     }`,
                loader: 'jsx',
                resolveDir: repoRoot,
              }),
            )
          },
        },
      ],
      bundle: true,
      format: 'iife',
      platform: 'browser',
      write: false,
    })
    const browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
    })
    try {
      const page = await browser.newPage()
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.setContent(
        '<html class="dark"><body><div id="root"></div></body></html>',
      )
      await page.addScriptTag({ content: bundle.outputFiles[0].text })
      const run = (source: string) => page.evaluate(source)
      await run('window.holdRender()')
      await run(`window.setDiagrams([${JSON.stringify(diagram)}])`)
      await page.waitForFunction('window.mermaidTest.active > 0')
      await run(
        `window.setDiagrams([${JSON.stringify(diagram)}, 'flowchart TD; A[Second diagram] --> B[Result]'])`,
      )
      // Flush React effects while the first render is deliberately held.
      await page.waitForFunction(
        () => document.querySelectorAll('#root pre').length === 2,
      )
      await run('window.releaseRender()')
      await page.waitForFunction(
        () =>
          document.querySelectorAll('#root .mermaid-block svg').length === 2,
      )

      const assertDiagrams = async (count: number) => {
        await page.waitForFunction(
          (count) =>
            document.querySelectorAll('#root .mermaid-block svg').length ===
            count,
          count,
        )
        await page.waitForFunction('window.mermaidTest.active === 0')
        assert.equal(await page.locator('body > div:not(#root)').count(), 0)
        assert.deepEqual(
          await page
            .locator('.mermaid-block')
            .first()
            .locator('.nodeLabel')
            .allTextContents(),
          [
            'Explicit design',
            'Generate permitted changes',
            'Independent model',
            'Compare promised public behavior',
            'Real DB',
          ],
        )
        assert.equal(
          await run('window.mermaidTest.configRaces'),
          0,
          'Mermaid configuration must stay fixed during a render',
        )
        assert.equal(
          await run('window.mermaidTest.visibleScratch'),
          0,
          'Temporary diagrams must never be visible outside their blocks',
        )
        assert.deepEqual(errors, [])
      }
      await assertDiagrams(2)
      const initialId = await page
        .locator('.mermaid-block svg')
        .first()
        .getAttribute('id')
      for (const dark of [false, true]) {
        const previousId = await page
          .locator('.mermaid-block svg')
          .first()
          .getAttribute('id')
        await page.evaluate(
          (dark) => document.documentElement.classList.toggle('dark', dark),
          dark,
        )
        await page.waitForFunction(
          (id) => document.querySelector('.mermaid-block svg')?.id !== id,
          previousId,
        )
        await assertDiagrams(2)
        assert.equal(
          await page
            .locator('.mermaid-block .node rect')
            .first()
            .evaluate((rect) => getComputedStyle(rect).fill),
          dark ? 'rgb(31, 32, 32)' : 'rgb(236, 236, 255)',
        )
      }
      assert.notEqual(
        await page.locator('.mermaid-block svg').first().getAttribute('id'),
        initialId,
      )

      await run(
        `window.setDiagrams([${JSON.stringify(diagram)}, 'not a diagram'])`,
      )
      await page.waitForFunction(
        () => document.querySelectorAll('#root pre').length === 1,
      )
      await page.waitForFunction('window.mermaidTest.active === 0')
      await assertDiagrams(1)
      await run(
        `window.setDiagrams([${JSON.stringify(diagram)}, 'flowchart TD; A[Recovered] --> B[Result]'])`,
      )
      await assertDiagrams(2)

      await run('window.holdRender()')
      await run(
        `window.setDiagrams([${JSON.stringify(diagram + '\n%% updated')}])`,
      )
      await page.waitForFunction('window.mermaidTest.active > 0')
      await run('window.setDiagrams([])')
      await page.waitForFunction(
        () => document.querySelector('#root')?.childElementCount === 0,
      )
      await run('window.releaseRender()')
      await page.waitForFunction('window.mermaidTest.active === 0')
      assert.equal(await page.locator('body svg').count(), 0)
      assert.equal(await page.locator('body > div:not(#root)').count(), 0)
      assert.deepEqual(errors, [])
    } finally {
      await browser.close()
    }
  },
)
