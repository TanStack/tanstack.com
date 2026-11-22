/// <reference types="node" />

import assert from 'node:assert/strict'
import { EventEmitter, once } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { chromium } from 'playwright-core'
import { build } from 'esbuild'
import sharp from 'sharp'
import { createServer } from 'vite'

const repoRoot = path.resolve(import.meta.dirname, '..')
const motion = '/images/hero-palm-cutout.webp'
const motionFile = path.join(repoRoot, 'public', motion)
const stillFile = path.join(
  repoRoot,
  'src/components/home/hero-palm-cutout-still.webp',
)
const stillPrefix = 'data:image/webp;base64,'
const vite = await createServer({
  root: repoRoot,
  configFile: false,
  resolve: { alias: { '~': path.join(repoRoot, 'src') } },
  server: { middlewareMode: true, ws: false, watch: null },
})
const serverMarkup = await (async () => {
  try {
    const { HeroPalmMedia } = await vite.ssrLoadModule(
      '/src/components/home/HeroPalmMedia.tsx',
    )
    return renderToString(createElement(HeroPalmMedia))
  } finally {
    await vite.close()
  }
})()
const chromePath = [
  process.env.CHROME_BIN,
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  chromium.executablePath(),
].find((candidate) => candidate && fs.existsSync(candidate))

test('the palm loop stays at 24 fps, matches its still, and fits the media budget', async () => {
  const animation = await sharp(motionFile).metadata()
  const poster = await sharp(stillFile).metadata()
  // The source has 121 frames at 24 fps. WebP stores whole milliseconds.
  const delays = Array.from(
    { length: 121 },
    (_, i) => Math.round(((i + 1) * 1000) / 24) - Math.round((i * 1000) / 24),
  )
  assert.deepEqual(animation.delay, delays)
  // The MP4 and its posters transferred 1.91 MB in the mobile baseline.
  assert.ok(
    fs.statSync(motionFile).size + fs.statSync(stillFile).size < 1_900_000,
    'the combined palm assets should stay under 1.90 MB',
  )
  assert.equal(animation.loop, 0)
  assert.ok(animation.hasAlpha && poster.hasAlpha)
  assert.equal(animation.width, poster.width)
  assert.equal(animation.height, poster.height)
  const firstFrame = await sharp(motionFile).ensureAlpha().raw().toBuffer()
  const stillFrame = await sharp(stillFile).ensureAlpha().raw().toBuffer()
  assert.ok(
    firstFrame.equals(stillFrame),
    'the still must match the first frame',
  )
})

test('the server inlines one visible still and preloads motion when allowed', () => {
  assert.doesNotMatch(serverMarkup, /<source\b|<video\b/)
  assert.equal(serverMarkup.match(/<img\b/g)?.length, 1)
  assert.ok(
    serverMarkup.includes(
      `src="${stillPrefix}${fs.readFileSync(stillFile, 'base64')}"`,
    ),
  )
  const [preload, ...extraPreloads] =
    serverMarkup.match(/<link[^>]+rel="preload"[^>]*>/g) ?? []
  assert.ok(preload)
  assert.equal(extraPreloads.length, 0)
  assert.ok(preload.includes(`href="${motion}"`))
  assert.match(preload, /media="\(prefers-reduced-motion: no-preference\)"/)
})

test(
  'responsive hero motion preference and image recovery',
  { skip: chromePath ? false : 'Chrome is not installed', timeout: 60_000 },
  async (t) => {
    const bundle = await build({
      stdin: {
        contents: `
          import React from 'react'
          import { hydrateRoot } from 'react-dom/client'
          import { HeroPalmMedia } from './src/components/home/HeroPalmMedia'
          function Harness() {
            React.useEffect(() => { document.documentElement.dataset.hydrated = 'true' }, [])
            return React.createElement(HeroPalmMedia)
          }
          hydrateRoot(document.getElementById('root'), React.createElement(Harness))
        `,
        resolveDir: repoRoot,
        loader: 'tsx',
      },
      alias: { '~': path.join(repoRoot, 'src') },
      loader: { '.webp': 'dataurl' },
      bundle: true,
      format: 'iife',
      platform: 'browser',
      write: false,
    })
    const browser = await chromium.launch({ executablePath: chromePath })
    t.after(() => browser.close())
    const context = await browser.newContext()

    async function openHero(
      width: number,
      reduced = false,
      failAnimation = false,
    ) {
      const page = await context.newPage()
      await page.setViewportSize({ width, height: 844 })
      await page.emulateMedia({
        reducedMotion: reduced ? 'reduce' : 'no-preference',
      })
      const requests: string[] = []
      const animation = new EventEmitter()
      const animationGate = once(animation, 'release')
      await page.route('http://hero.test/**', async (route) => {
        const url = new URL(route.request().url())
        if (url.pathname === '/') {
          return route.fulfill({
            contentType: 'text/html',
            body: `<!doctype html><div id="root">${serverMarkup}</div>`,
          })
        }
        requests.push(url.pathname)
        await animationGate
        if (failAnimation) return route.abort()
        return route.fulfill({
          path: path.join(repoRoot, 'public', url.pathname),
        })
      })
      await page.goto('http://hero.test/', { waitUntil: 'domcontentloaded' })
      const hydrate = async () => {
        await page.addScriptTag({ content: bundle.outputFiles[0].text })
        await page.waitForFunction(
          () => document.documentElement.dataset.hydrated === 'true',
        )
      }
      return {
        page,
        requests,
        hydrate,
        still: page.locator(`img[src^="${stillPrefix}"]`),
        motion: page.locator(`img[src="${motion}"]`),
        releaseAnimation: () => animation.emit('release'),
      }
    }

    for (const width of [390, 844, 1024, 1512]) {
      const hero = await openHero(width)
      await hero.still.waitFor({ state: 'visible' })
      assert.ok(
        await hero.still.evaluate(
          (image) => image instanceof HTMLImageElement && image.naturalWidth,
        ),
      )
      await hero.hydrate()
      await hero.motion.waitFor({ state: 'attached' })
      assert.equal(await hero.motion.isHidden(), true)
      assert.equal(await hero.still.isVisible(), true)
      hero.releaseAnimation()
      await hero.motion.waitFor({ state: 'visible' })
      assert.deepEqual(hero.requests, [motion])
      assert.equal(await hero.still.isHidden(), true)
      await hero.page.close()
    }

    const reduced = await openHero(390, true)
    reduced.releaseAnimation()
    await reduced.still.waitFor({ state: 'visible' })
    await reduced.hydrate()
    assert.equal(await reduced.motion.count(), 0)
    assert.deepEqual(reduced.requests, [])
    await reduced.page.emulateMedia({ reducedMotion: 'no-preference' })
    await reduced.motion.waitFor({ state: 'visible' })
    await reduced.page.emulateMedia({ reducedMotion: 'reduce' })
    await reduced.still.waitFor({ state: 'visible' })
    assert.equal(await reduced.motion.isHidden(), true)
    await reduced.page.close()

    const failed = await openHero(1512, false, true)
    await failed.hydrate()
    await failed.motion.waitFor({ state: 'attached' })
    const requestFailed = failed.page.waitForEvent('requestfailed', (request) =>
      request.url().endsWith(motion),
    )
    failed.releaseAnimation()
    await requestFailed
    assert.equal(await failed.motion.isHidden(), true)
    assert.equal(await failed.still.isVisible(), true)
    await failed.page.close()
  },
)
