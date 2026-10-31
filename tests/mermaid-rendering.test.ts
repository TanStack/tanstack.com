import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import { register, render } from 'pele/core'
import flowchart from 'pele/diagrams/flowchart'

register(flowchart)

const repoRoot = path.resolve(import.meta.dirname, '..')
const chromePath = [
  process.env.CHROME_BIN,
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  chromium.executablePath(),
].find((candidate) => candidate && existsSync(candidate))
const diagrams = readdirSync(path.join(repoRoot, 'src/blog')).flatMap((file) =>
  [
    ...readFileSync(path.join(repoRoot, 'src/blog', file), 'utf8').matchAll(
      /```mermaid\n([\s\S]*?)```/g,
    ),
  ].map((match) => match[1]),
)
const appCss = readFileSync(path.join(repoRoot, 'src/styles/app.css'), 'utf8')
const diagramCss = appCss.slice(appCss.indexOf('/* Pele keeps'))
const siteNeutralCss = appCss.match(/:root,\n:host \{[\s\S]*?\n\}/)?.[0]
assert.ok(siteNeutralCss)
const themeCss = readFileSync(
  path.join(repoRoot, 'node_modules/tailwindcss/theme.css'),
  'utf8',
).replace('@theme default', ':root')

test('Pele renders every existing article diagram at desktop and phone widths', () => {
  assert.ok(diagrams.length >= 5)
  for (const code of diagrams) {
    for (const maxWidth of [844, 308]) {
      const result = render(code, { maxWidth })
      assert.ok(result.width > 0 && result.height > 0)
      assert.match(result.svg, /<svg/)
    }
  }
})

test(
  'Pele handles themes, responsive layout without zoom, source changes, errors, IDs, and cleanup',
  { skip: chromePath ? false : 'Chrome is not installed', timeout: 60_000 },
  async () => {
    const bundle = await build({
      stdin: {
        contents: `
          import React from 'react'
          import { createRoot } from 'react-dom/client'
          import { MermaidBlock } from './src/components/markdown/MermaidBlock'
          const root = createRoot(document.getElementById('root'))
          window.setDiagrams = codes => root.render(
            React.createElement(React.StrictMode, null,
              codes.map((code, index) => React.createElement(MermaidBlock, { key: index, code, title: 'Article diagram' }))
            )
          )
        `,
        loader: 'tsx',
        resolveDir: repoRoot,
      },
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
      const page = await browser.newPage({
        viewport: { width: 1200, height: 900 },
      })
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      await page.setContent(`<html class="dark"><head><style>${themeCss}\n${siteNeutralCss}\n${diagramCss}
        #root {width:844px} .mermaid-block {box-sizing:border-box;width:100%;padding:16px;overflow:hidden}
        .mermaid-block > svg {display:block;margin:auto} [hidden] {display:none!important}
      </style></head><body><aside>Navigation and sponsors</aside><div id="root"></div></body></html>`)
      await page.addScriptTag({ content: bundle.outputFiles[0].text })
      const run = (source: string) => page.evaluate(source)
      const setDiagrams = (codes: string[]) =>
        run(`window.setDiagrams(${JSON.stringify(codes)})`)
      const waitForDiagrams = (count: number) =>
        page.waitForFunction(
          (count) =>
            document.querySelectorAll('.mermaid-block:not([hidden]) > svg')
              .length === count,
          count,
        )
      await setDiagrams(diagrams)
      await waitForDiagrams(diagrams.length)
      assert.equal(await page.locator('#root pre').count(), 0)
      const ids = await page
        .locator('.mermaid-block [id]')
        .evaluateAll((els) => els.map((el) => el.id))
      assert.equal(
        ids.length,
        new Set(ids).size,
        'IDs must be unique across diagrams',
      )
      await run(
        'window.initialSvg = document.querySelector(".mermaid-block > svg")',
      )
      const label = page.locator('.pele-node .pele-label').first()
      const darkFill = await label.evaluate((el) => getComputedStyle(el).fill)
      await run('document.documentElement.classList.remove("dark")')
      const lightFill = await label.evaluate((el) => getComputedStyle(el).fill)
      assert.notEqual(lightFill, darkFill)
      assert.equal(
        await run(
          'window.initialSvg === document.querySelector(".mermaid-block > svg")',
        ),
        true,
      )
      await run('document.documentElement.classList.add("dark")')
      assert.equal(
        await label.evaluate((el) => getComputedStyle(el).fill),
        darkFill,
      )

      await setDiagrams([
        'flowchart LR\n A[First] --> B[Second] --> C[Third] --> D[Fourth] --> E[Fifth]',
      ])
      await waitForDiagrams(1)
      await page.waitForFunction(
        () => document.querySelector('.pele-label')?.textContent === 'First',
      )
      const wideHeight = await page
        .locator('.mermaid-block > svg')
        .evaluate((svg) => svg.getBoundingClientRect().height)
      await run('document.getElementById("root").style.width = "308px"')
      await page.waitForFunction(
        (height) =>
          document
            .querySelector('.mermaid-block > svg')!
            .getBoundingClientRect().height > height,
        wideHeight,
      )
      assert.equal(await page.locator('.pele-node').count(), 5)

      // Responsive layout remains enabled, but diagrams have no zoom UI.
      await setDiagrams([
        'flowchart TD\n A[Root] --> B[Long left label]\n A --> C[Long middle label]\n A --> D[Long right label]',
      ])
      await waitForDiagrams(1)
      await page.waitForFunction(
        () => document.querySelector('.pele-label')?.textContent === 'Root',
      )
      assert.equal(await page.locator('.pele-zoom').count(), 0)
      assert.equal(
        await page
          .getByRole('button', { name: 'Zoom in', exact: true })
          .count(),
        0,
      )
      assert.equal(
        await page.locator('.mermaid-block > svg').getAttribute('tabindex'),
        null,
      )

      // Explicit source fills retain contrasting labels in either site theme.
      await setDiagrams([
        'flowchart LR\n A[Light fill] --> B[Dark fill]\n style A fill:#ffffff\n style B fill:#000000',
      ])
      await waitForDiagrams(1)
      await page.waitForFunction(
        () =>
          document.querySelector('.pele-label')?.textContent === 'Light fill',
      )
      for (const dark of [false, true]) {
        await page.evaluate(
          (dark) => document.documentElement.classList.toggle('dark', dark),
          dark,
        )
        const fills = await page
          .locator('.pele-node .pele-label')
          .evaluateAll((els) => els.map((el) => getComputedStyle(el).fill))
        assert.deepEqual(fills, ['rgb(31, 31, 31)', 'rgb(255, 255, 255)'])
      }

      // Pie values use the diagram background as their text color. Every
      // categorical fill must contrast with it, in both site themes.
      for (const dark of [false, true]) {
        await page.evaluate(
          (dark) => document.documentElement.classList.toggle('dark', dark),
          dark,
        )
        const contrasts = await page
          .locator('.mermaid-block')
          .evaluate((el) => {
            const css = getComputedStyle(el)
            const canvas = document.createElement('canvas')
            canvas.width = canvas.height = 1
            const context = canvas.getContext('2d')!
            const colorMath = {
              luminance(color: string) {
                context.fillStyle = color
                context.fillRect(0, 0, 1, 1)
                const rgb = context.getImageData(0, 0, 1, 1).data
                const linear = [rgb[0], rgb[1], rgb[2]].map((value) => {
                  const channel = value / 255
                  return channel <= 0.04045
                    ? channel / 12.92
                    : ((channel + 0.055) / 1.055) ** 2.4
                })
                return (
                  linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
                )
              },
            }
            const bg = colorMath.luminance(css.getPropertyValue('--pele-bg'))
            return Array.from({ length: 8 }, (_, i) => {
              const fill = colorMath.luminance(
                css.getPropertyValue('--pele-series-' + (i + 1)),
              )
              return (Math.max(bg, fill) + 0.05) / (Math.min(bg, fill) + 0.05)
            })
          })
        assert.ok(
          contrasts.every((ratio) => ratio >= 4.5),
          JSON.stringify(contrasts),
        )
      }

      // A diagram mounted inside a collapsed article section must recover on reveal.
      await run('document.getElementById("root").style.display = "none"')
      await setDiagrams([
        'flowchart LR\n A[Initially hidden] --> B[Visible later]',
      ])
      await waitForDiagrams(1)
      await run('document.getElementById("root").style.display = "block"')
      await page.waitForFunction(
        () =>
          document
            .querySelector('.mermaid-block > svg')!
            .getBoundingClientRect().width > 0,
      )
      assert.match(
        await page.locator('.mermaid-block').innerText(),
        /Initially hidden/,
      )

      await setDiagrams(['not a diagram <img src=x onerror=alert(1)>'])
      await page.locator('.pele-error').waitFor()
      assert.match(
        await page.locator('.pele-error').innerText(),
        /No diagram type detected/,
      )
      assert.equal(await page.locator('.mermaid-block > svg').count(), 0)
      assert.equal(await page.locator('#root img').count(), 0)
      await setDiagrams(['sequenceDiagram\n Alice->>Bob: Not registered'])
      await page.locator('.pele-error').waitFor()
      assert.match(
        await page.locator('.pele-error').innerText(),
        /not supported/,
      )
      await setDiagrams(['flowchart LR\n A[Recovered] --> B[Result]'])
      await waitForDiagrams(1)
      assert.match(
        await page.locator('.mermaid-block').innerText(),
        /Recovered/,
      )

      await setDiagrams([
        'flowchart LR\n A[Link] --> B[End]\n click A "https://example.com"',
      ])
      await waitForDiagrams(1)
      await page.waitForFunction(
        () => document.querySelector('.pele-label')?.textContent === 'Link',
      )
      assert.equal(await page.locator('.mermaid-block a').count(), 0)
      await setDiagrams([])
      await page.waitForFunction(
        () => document.querySelector('#root')?.childElementCount === 0,
      )
      await page.setViewportSize({ width: 400, height: 800 })
      await setDiagrams(['flowchart TD\n A[Remounted] --> B[Result]'])
      await waitForDiagrams(1)
      assert.match(
        await page.locator('.mermaid-block').innerText(),
        /Remounted/,
      )
      assert.equal(await page.locator('body > div:not(#root)').count(), 0)
      assert.equal(
        await page
          .getByText('Navigation and sponsors', { exact: true })
          .isVisible(),
        true,
      )
      assert.deepEqual(errors, [])
    } finally {
      await browser.close()
    }
  },
)

test(
  'diagram source renders on the server and stays visible until its lazy chunk loads',
  { skip: chromePath ? false : 'Chrome is not installed', timeout: 60_000 },
  async () => {
    const source = 'flowchart TD; A[Loaded] --> B[Result]'
    // Isolate the existing code-block UI from unrelated toast providers.
    const fallbackPlugin = {
      name: 'code-block-fallback',
      setup(pluginBuild: import('esbuild').PluginBuild) {
        pluginBuild.onResolve({ filter: /^\.\/CodeBlockView$/ }, () => ({
          path: 'fallback',
          namespace: 'test',
        }))
        pluginBuild.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
          contents: `import React from 'react'; export function CodeBlockView({copyText,htmlMarkup}) { return React.createElement('section', {'data-copy':copyText, dangerouslySetInnerHTML:{__html:htmlMarkup}}) }`,
          loader: 'jsx',
          resolveDir: repoRoot,
        }))
      },
    }
    const server = await build({
      stdin: {
        contents: `
          import React from 'react'
          import { renderToString } from 'react-dom/server'
          import { CodeBlock } from './src/components/markdown/CodeBlock'
          export const html = renderToString(React.createElement(CodeBlock, null,
            React.createElement('code', {className:'language-mermaid'}, ${JSON.stringify(source)})
          ))
        `,
        resolveDir: repoRoot,
      },
      plugins: [
        fallbackPlugin,
        {
          name: 'external-node-packages',
          setup(pluginBuild) {
            pluginBuild.onResolve({ filter: /^[^./]/ }, (args) => ({
              path: import.meta.resolve(args.path),
              external: true,
            }))
          },
        },
      ],
      bundle: true,
      platform: 'node',
      format: 'esm',
      write: false,
    })
    const { html } = await import(
      `data:text/javascript;base64,${Buffer.from(server.outputFiles[0].text).toString('base64')}`
    )
    assert.match(html, /<pre/)
    assert.match(html, /A\[Loaded\]/)
    assert.match(html, /data-copy=/)
    assert.doesNotMatch(html, /<svg|mermaid-block/)

    const bundle = await build({
      stdin: {
        contents: `
          import React from 'react'
          import { createRoot } from 'react-dom/client'
          import { CodeBlock } from './src/components/markdown/CodeBlock'
          const root = createRoot(document.getElementById('root'))
          function Page() {
            const [block, setBlock] = React.useState({language:'ts',code:'const value = 1'})
            window.showCode = (language,code) => setBlock({language,code})
            return React.createElement('main', null,
              React.createElement('aside', null, 'Navigation and sponsors'),
              React.createElement(CodeBlock, null,
                React.createElement('code', {className:'language-'+block.language}, block.code)
              )
            )
          }
          root.render(React.createElement(Page))
        `,
        loader: 'tsx',
        resolveDir: repoRoot,
      },
      plugins: [fallbackPlugin],
      bundle: true,
      splitting: true,
      format: 'esm',
      platform: 'browser',
      outdir: '/tmp/pele-loading-test',
      write: false,
    })
    const browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
    })
    let release = () => {}
    const gate = new Promise((resolve) => {
      release = () => resolve(undefined)
    })
    let diagramRequests = 0
    try {
      const page = await browser.newPage()
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.route('https://pele-test.invalid/**', async (route) => {
        const filename = new URL(route.request().url()).pathname.slice(1)
        if (!filename) {
          await route.fulfill({
            contentType: 'text/html',
            body: '<div id="root"></div><script type="module" src="/stdin.js"></script>',
          })
          return
        }
        if (filename.startsWith('MermaidBlock-')) {
          diagramRequests++
          await gate
        }
        const file = bundle.outputFiles.find(
          (file) => path.basename(file.path) === filename,
        )
        assert.ok(file, filename)
        await route.fulfill({ contentType: 'text/javascript', body: file.text })
      })
      await page.goto('https://pele-test.invalid/')
      await page.getByText('const value = 1', { exact: true }).waitFor()
      assert.equal(diagramRequests, 0)
      await page.evaluate(
        `window.showCode('mermaid',${JSON.stringify(source)})`,
      )
      await page.getByText(source, { exact: true }).waitFor()
      assert.equal(
        await page
          .getByText('Navigation and sponsors', { exact: true })
          .isVisible(),
        true,
      )
      assert.equal(await page.locator('.mermaid-block > svg').count(), 0)
      release()
      await page.locator('.mermaid-block > svg').waitFor()
      assert.equal(diagramRequests, 1)
      assert.equal(await page.locator('#root pre').count(), 0)
      assert.equal(
        await page
          .getByText('Navigation and sponsors', { exact: true })
          .isVisible(),
        true,
      )
      assert.deepEqual(errors, [])
    } finally {
      release()
      await browser.close()
    }
  },
)
