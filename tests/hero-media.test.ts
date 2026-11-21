/// <reference types="node" />

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { chromium } from 'playwright-core'
import { build } from 'esbuild'
import { HeroPalmMedia } from '../src/components/home/HeroPalmMedia'

const repoRoot = path.resolve(import.meta.dirname, '..')
const mobileMotion = '/images/hero-palm-motion-mobile.webp'
const desktopMotion = '/images/hero-palm-motion.webp'
const serverMarkup = renderToString(createElement(HeroPalmMedia))
const chromePath = [
  process.env.CHROME_BIN,
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  chromium.executablePath(),
].find((candidate) => candidate && fs.existsSync(candidate))

test('server render lets the browser select a single eager hero image', () => {
  assert.doesNotMatch(serverMarkup, /<video\b|\.m3u8|\.mp4|rel="preload"/)
  assert.match(serverMarkup, /<picture\b/)
  assert.ok(serverMarkup.includes(mobileMotion))
  assert.ok(serverMarkup.includes(desktopMotion))
  assert.match(serverMarkup, /srcSet="\/images\/hero-palm-gradient-/)
  assert.match(serverMarkup, /loading="eager"/)
  assert.match(serverMarkup, /fetchPriority="high"/)
})

test(
  'responsive hero animation, reduced motion, pause and recovery',
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
      failMotion = false,
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
        if (failMotion && url.pathname.includes('-motion')) {
          failMotion = false
          return route.abort()
        }
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
      const file = width < 1024 ? mobileMotion : desktopMotion
      const hero = await openHero(width)
      await hero.waitForImage(file)
      assert.deepEqual(hero.requests, [file])
      await hero.page.close()
    }

    const reduced = await openHero(390, true)
    await reduced.waitForImage('/hero-palm-gradient-1600.webp')
    await reduced.hydrate()
    await reduced.page.emulateMedia({ reducedMotion: 'no-preference' })
    await reduced.waitForImage('-gradient-')
    assert.equal(
      reduced.requests.some((url) => url.includes('-motion')),
      false,
    )
    await reduced.page
      .getByRole('button', { name: 'Play hero animation' })
      .press('Enter')
    await reduced.waitForImage(mobileMotion)
    await reduced.page
      .getByRole('button', { name: 'Pause hero animation' })
      .press('Enter')
    await reduced.waitForImage('-gradient-')
    await reduced.page
      .getByRole('button', { name: 'Play hero animation' })
      .click()
    await reduced.waitForImage(mobileMotion)
    await reduced.page.emulateMedia({ reducedMotion: 'reduce' })
    await reduced.waitForImage('-gradient-')
    await reduced.page.close()

    const failed = await openHero(1512, false, true)
    await failed.hydrate()
    await failed.waitForImage('-gradient-')
    await failed.page
      .getByRole('button', { name: 'Play hero animation' })
      .click()
    await failed.waitForImage(desktopMotion)
    await failed.page.close()
  },
)
