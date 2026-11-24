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
const motion = '/images/hero-palm-loop.mp4'
const motionFile = path.join(repoRoot, 'public', motion)
const stillFile = path.join(
  repoRoot,
  'src/components/home/hero-palm-loop-still.webp',
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

test('the palm video and still fit the media budget', async () => {
  assert.ok(
    fs.statSync(motionFile).size + fs.statSync(stillFile).size < 1_900_000,
    'the combined palm assets should stay under 1.90 MB',
  )
  const poster = await sharp(stillFile).metadata()
  assert.equal(poster.hasAlpha, false)
})

test('the server inlines one visible still', () => {
  assert.doesNotMatch(serverMarkup, /<source\b|<video\b/)
  assert.equal(serverMarkup.match(/<img\b/g)?.length, 1)
  assert.ok(
    serverMarkup.includes(
      `src="${stillPrefix}${fs.readFileSync(stillFile, 'base64')}"`,
    ),
  )
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
            body: `<!doctype html><style>.opacity-0{opacity:0}</style><div id="root">${serverMarkup}</div>`,
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
        motion: page.locator(`video[src="${motion}"]`),
        releaseAnimation: () => animation.emit('release'),
      }
    }

    for (const width of [390, 1512]) {
      const hero = await openHero(width)
      await hero.still.waitFor({ state: 'visible' })
      assert.ok(
        await hero.still.evaluate(
          (image) => image instanceof HTMLImageElement && image.naturalWidth,
        ),
      )
      await hero.hydrate()
      await hero.motion.waitFor({ state: 'attached' })
      assert.equal(
        await hero.motion.evaluate((video) => getComputedStyle(video).opacity),
        '0',
      )
      hero.releaseAnimation()
      await hero.page.waitForFunction(() => {
        const video = document.querySelector('video')
        return (
          video &&
          video.currentTime > 0 &&
          getComputedStyle(video).opacity === '1'
        )
      })
      assert.ok(hero.requests.length > 0)
      assert.ok(hero.requests.every((request) => request === motion))
      await hero.page.close()
    }

    const reduced = await openHero(390, true)
    reduced.releaseAnimation()
    await reduced.hydrate()
    assert.equal(await reduced.motion.count(), 0)
    assert.deepEqual(reduced.requests, [])
    await reduced.page.emulateMedia({ reducedMotion: 'no-preference' })
    await reduced.motion.waitFor({ state: 'attached' })
    await reduced.page.emulateMedia({ reducedMotion: 'reduce' })
    await reduced.motion.waitFor({ state: 'detached' })
    assert.equal(await reduced.still.isVisible(), true)
    await reduced.page.close()

    const failed = await openHero(1512, false, true)
    await failed.hydrate()
    await failed.motion.waitFor({ state: 'attached' })
    const requestFailed = failed.page.waitForEvent('requestfailed', (request) =>
      request.url().endsWith(motion),
    )
    failed.releaseAnimation()
    await requestFailed
    assert.equal(
      await failed.motion.evaluate((video) => getComputedStyle(video).opacity),
      '0',
    )
    assert.equal(await failed.still.isVisible(), true)
    await failed.page.close()
  },
)
