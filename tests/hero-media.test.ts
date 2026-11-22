/// <reference types="node" />

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { chromium } from 'playwright-core'
import { build } from 'esbuild'
import sharp from 'sharp'
import { HeroPalmMedia } from '../src/components/home/HeroPalmMedia'

const repoRoot = path.resolve(import.meta.dirname, '..')
const motion = '/images/hero-palm-cutout.webp'
const still = '/images/hero-palm-cutout-still.webp'
const serverMarkup = renderToString(createElement(HeroPalmMedia))
const chromePath = [
  process.env.CHROME_BIN,
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  chromium.executablePath(),
].find((candidate) => candidate && fs.existsSync(candidate))

test('the palm loop stays at 24 fps, matches its still, and fits the media budget', async () => {
  const animation = await sharp(
    path.join(repoRoot, 'public', motion),
  ).metadata()
  const poster = await sharp(path.join(repoRoot, 'public', still)).metadata()
  // The excerpt plays at the source rate of 24 fps. WebP stores whole milliseconds.
  const delays = Array.from(
    { length: 70 },
    (_, i) => Math.round(((i + 1) * 1000) / 24) - Math.round((i * 1000) / 24),
  )
  assert.deepEqual(animation.delay, delays)
  const assetSize = (file: string) =>
    fs.statSync(path.join(repoRoot, 'public', file)).size
  assert.ok(
    assetSize(motion) + assetSize(still) <
      assetSize('/images/hero-palm-motion.mp4'),
    'both palm images together should be smaller than the original MP4',
  )
  assert.equal(animation.loop, 0)
  assert.ok(animation.hasAlpha && poster.hasAlpha)
  assert.equal(animation.width, poster.width)
  assert.equal(animation.height, poster.height)
  const firstFrame = await sharp(path.join(repoRoot, 'public', motion))
    .ensureAlpha()
    .raw()
    .toBuffer()
  const stillFrame = await sharp(path.join(repoRoot, 'public', still))
    .ensureAlpha()
    .raw()
    .toBuffer()
  assert.ok(
    firstFrame.equals(stillFrame),
    'the still must match the first frame',
  )
})

test('the server preloads the first frame for everyone and motion when requested', () => {
  assert.doesNotMatch(serverMarkup, /<video\b|<summary\b|<button\b/)
  const preloads = serverMarkup.match(/<link[^>]+rel="preload"[^>]*>/g) ?? []
  assert.equal(preloads.length, 2)
  const poster = preloads.find((tag) => tag.includes(`href="${still}"`))
  const animation = preloads.find((tag) => tag.includes(`href="${motion}"`))
  assert.ok(poster && animation)
  assert.doesNotMatch(poster, /media=/)
  assert.match(animation, /media="\(prefers-reduced-motion: no-preference\)"/)
  assert.match(poster, /fetchPriority="high"/i)
  assert.match(animation, /fetchPriority="high"/i)
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
      bundle: true,
      format: 'iife',
      platform: 'browser',
      write: false,
    })
    const browser = await chromium.launch({ executablePath: chromePath })
    t.after(() => browser.close())

    async function openHero(
      width: number,
      reduced = false,
      failOnce = new Set<string>(),
    ) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        reducedMotion: reduced ? 'reduce' : 'no-preference',
      })
      const requests: string[] = []
      await page.route('http://hero.test/**', (route) => {
        const url = new URL(route.request().url())
        if (url.pathname === '/') {
          return route.fulfill({
            contentType: 'text/html',
            body: `<!doctype html><div id="root">${serverMarkup}</div>`,
          })
        }
        requests.push(url.pathname)
        if (failOnce.delete(url.pathname)) return route.abort()
        return route.fulfill({
          path: path.join(repoRoot, 'public', url.pathname),
        })
      })
      await page.goto('http://hero.test/')
      const hydrate = async () => {
        await page.addScriptTag({ content: bundle.outputFiles[0].text })
        await page.waitForFunction(
          () => document.documentElement.dataset.hydrated === 'true',
        )
      }
      const waitForImage = (source: string) =>
        page.waitForFunction((part) => {
          const img = document.querySelector('picture img')
          return (
            img instanceof HTMLImageElement &&
            img.complete &&
            img.naturalWidth > 0 &&
            img.currentSrc.includes(part)
          )
        }, source)
      return { page, requests, hydrate, waitForImage }
    }

    for (const width of [390, 844, 1024, 1512]) {
      const hero = await openHero(width)
      await hero.waitForImage(motion)
      assert.deepEqual([...hero.requests].sort(), [still, motion].sort())
      assert.equal(await hero.page.locator('picture img').isVisible(), true)
      await hero.hydrate()
      assert.deepEqual([...hero.requests].sort(), [still, motion].sort())
      await hero.page.close()
    }

    const reduced = await openHero(390, true)
    await reduced.waitForImage(still)
    await reduced.hydrate()
    assert.deepEqual(reduced.requests, [still])
    await reduced.page.emulateMedia({ reducedMotion: 'no-preference' })
    await reduced.waitForImage(motion)
    await reduced.page.emulateMedia({ reducedMotion: 'reduce' })
    await reduced.waitForImage(still)
    await reduced.page.close()

    const failed = await openHero(1512, false, new Set([motion]))
    await failed.hydrate()
    await failed.waitForImage(still)
    assert.ok(failed.requests.includes(motion))
    await failed.page.close()
  },
)
