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
const componentPath = path.join(
  repoRoot,
  'src/components/home/HeroPalmMedia.tsx',
)
const videoPath = path.join(repoRoot, 'public/images/hero-palm-motion.mp4')
const serverMarkup = renderToString(createElement(HeroPalmMedia))
const chromePath = [
  process.env.CHROME_BIN,
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  chromium.executablePath(),
].find((candidate) => candidate && fs.existsSync(candidate))

test('server render keeps the still image without requesting motion media', () => {
  const markup = renderToString(createElement(HeroPalmMedia))
  const videoMarkup = markup.match(/<video\b[^>]*>/)?.[0]

  assert.ok(videoMarkup)
  assert.doesNotMatch(videoMarkup, /\s(?:src|poster)=/)
  assert.match(markup, /srcSet="\/images\/hero-palm-gradient-/)
  assert.match(markup, /loading="eager"/)
  assert.match(markup, /fetchPriority="high"/)
})

test(
  'hero media gates motion downloads, honors preference changes, and retains the still image',
  { skip: chromePath ? false : 'Chrome is not installed', timeout: 60_000 },
  async () => {
    const bundle = await build({
      stdin: {
        contents: `
          import React from 'react'
          import { hydrateRoot } from 'react-dom/client'
          import { HeroPalmMedia } from ${JSON.stringify(componentPath)}

          function HydrationHarness() {
            React.useEffect(() => {
              document.documentElement.dataset.heroMediaHydrated = 'true'
            }, [])
            return React.createElement(HeroPalmMedia)
          }

          hydrateRoot(
            document.getElementById('root'),
            React.createElement(HydrationHarness),
          )
        `,
        resolveDir: repoRoot,
        sourcefile: 'hero-media-browser-test.tsx',
        loader: 'tsx',
      },
      alias: { '~': path.join(repoRoot, 'src') },
      bundle: true,
      format: 'iife',
      platform: 'browser',
      write: false,
    })
    const browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
    })

    const makePage = async (
      reducedMotion: 'reduce' | 'no-preference',
      videoResponse: 'hold' | 'fail' = 'hold',
      hydrateImmediately = true,
    ) => {
      const page = await browser.newPage()
      let videoRequests = 0
      let jpegRequests = 0
      const pageErrors: string[] = []
      const consoleErrors: string[] = []
      let resolveVideoRequest = () => {}
      const videoRequest = new Promise<void>((resolve) => {
        resolveVideoRequest = resolve
      })
      let releaseVideoResponse = () => {}
      const videoResponseGate = new Promise<void>((resolve) => {
        releaseVideoResponse = resolve
      })

      await page.emulateMedia({ reducedMotion })
      page.on('pageerror', (error) => pageErrors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
      })
      page.on('request', (request) => {
        const pathname = new URL(request.url()).pathname
        if (pathname.endsWith('/images/hero-palm-motion.mp4')) {
          videoRequests += 1
          resolveVideoRequest()
        }
        if (pathname.endsWith('.jpg')) jpegRequests += 1
      })
      await page.route('**/images/hero-palm-motion.mp4', async (route) => {
        if (videoResponse === 'fail') {
          await route.abort()
          return
        }
        await videoResponseGate
        await route.fulfill({ path: videoPath, contentType: 'video/mp4' })
      })
      await page.route('**/images/hero-palm-gradient*', async (route) => {
        const filename = path.basename(new URL(route.request().url()).pathname)
        await route.fulfill({
          path: path.join(repoRoot, 'public/images', filename),
        })
      })
      await page.setContent(
        `<!doctype html><html><head><base href="http://hero-media.test/"></head><body><div id="root">${serverMarkup}</div></body></html>`,
      )
      const hydrate = () =>
        page.addScriptTag({ content: bundle.outputFiles[0].text })
      if (hydrateImmediately) await hydrate()
      await page.locator('img').evaluate((image) => {
        if (!(image instanceof HTMLImageElement)) {
          throw new Error('Expected the hero still image')
        }
        return image.decode()
      })

      return {
        page,
        get videoRequests() {
          return videoRequests
        },
        get jpegRequests() {
          return jpegRequests
        },
        pageErrors,
        consoleErrors,
        hydrate,
        videoRequest,
        releaseVideoResponse,
      }
    }

    try {
      const reduced = await makePage('reduce', 'hold', false)
      const reducedVideo = reduced.page.locator('video')
      assert.equal(reduced.videoRequests, 0)
      assert.equal(reduced.jpegRequests, 0)
      assert.equal(await reducedVideo.getAttribute('src'), null)

      await reduced.hydrate()
      await reduced.page.waitForFunction(
        () => document.documentElement.dataset.heroMediaHydrated === 'true',
      )
      assert.deepEqual(
        {
          poster: await reducedVideo.getAttribute('poster'),
          source: await reducedVideo.getAttribute('src'),
          sourceElements: await reducedVideo.locator('source').count(),
          requests: reduced.videoRequests,
          jpegRequests: reduced.jpegRequests,
        },
        {
          poster: null,
          source: null,
          sourceElements: 0,
          requests: 0,
          jpegRequests: 0,
        },
      )

      await reduced.page.emulateMedia({ reducedMotion: 'no-preference' })
      assert.equal(await reducedVideo.getAttribute('src'), null)
      assert.equal(reduced.videoRequests, 0)

      await reduced.page
        .getByRole('button', { name: 'Play hero animation' })
        .click()
      await reduced.videoRequest
      assert.equal(reduced.videoRequests, 1)
      assert.equal(
        await reducedVideo.evaluate(
          (video) => getComputedStyle(video).visibility,
        ),
        'hidden',
      )
      assert.equal(
        await reduced.page.locator('img').evaluate((image) => {
          if (!(image instanceof HTMLImageElement)) {
            throw new Error('Expected the hero still image')
          }
          return image.complete
        }),
        true,
      )
      reduced.releaseVideoResponse()
      await reducedVideo.waitFor({ state: 'visible' })
      await reduced.page.waitForFunction(
        () => document.querySelector('video')?.paused === false,
      )
      await reduced.page.close()

      const normal = await makePage('no-preference')
      const normalVideo = normal.page.locator('video')
      assert.equal(
        await normal.page.evaluate(
          () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        ),
        false,
      )
      assert.equal(
        await normalVideo.getAttribute('src'),
        '/images/hero-palm-motion.mp4',
      )
      await normal.videoRequest
      assert.equal(normal.videoRequests, 1)
      assert.equal(normal.jpegRequests, 0)
      assert.equal(
        await normalVideo.evaluate(
          (video) => getComputedStyle(video).visibility,
        ),
        'hidden',
      )
      normal.releaseVideoResponse()
      await normal.page.waitForFunction(() => {
        const video = document.querySelector('video')
        return video !== null && video.readyState >= 3
      })
      await normal.page.waitForFunction(
        () => document.querySelector('video')?.paused === false,
      )
      assert.equal(await normalVideo.getAttribute('poster'), null)
      assert.equal(
        await normalVideo.evaluate(
          (video) => getComputedStyle(video).visibility,
        ),
        'visible',
      )

      await normal.page.emulateMedia({ reducedMotion: 'reduce' })
      await normal.page.waitForFunction(
        () => document.querySelector('video')?.paused === true,
      )
      await normal.page.emulateMedia({ reducedMotion: 'no-preference' })
      assert.equal(
        await normalVideo.evaluate((video) => {
          if (!(video instanceof HTMLVideoElement)) {
            throw new Error('Expected the hero video')
          }
          return video.paused
        }),
        true,
      )
      assert.equal(normal.videoRequests, 1)

      await normal.page
        .getByRole('button', { name: 'Play hero animation' })
        .press('Enter')
      await normal.page.waitForFunction(
        () => document.querySelector('video')?.paused === false,
      )
      await normal.page
        .getByRole('button', { name: 'Pause hero animation' })
        .press('Enter')
      await normal.page.waitForFunction(
        () => document.querySelector('video')?.paused === true,
      )
      assert.equal(normal.videoRequests, 1)
      await normalVideo.evaluate((video) => {
        if (!(video instanceof HTMLVideoElement)) {
          throw new Error('Expected the hero video')
        }
        const play = video.play.bind(video)
        video.play = () => {
          video.play = play
          return Promise.reject(
            new DOMException('Playback blocked', 'NotAllowedError'),
          )
        }
      })
      await normal.page
        .getByRole('button', { name: 'Play hero animation' })
        .press('Enter')
      await normal.page.waitForFunction(
        () => document.querySelector('video')?.style.visibility === 'hidden',
      )
      assert.deepEqual(normal.pageErrors, [])
      assert.ok(
        normal.consoleErrors.some((message) =>
          message.includes('Unable to play the homepage hero animation'),
        ),
      )
      await normal.page
        .getByRole('button', { name: 'Play hero animation' })
        .press('Enter')
      await normal.page.waitForFunction(() => {
        const video = document.querySelector('video')
        return video?.paused === false && video.style.visibility === 'visible'
      })
      await normal.page.close()

      const failed = await makePage('no-preference', 'fail')
      await failed.videoRequest
      await failed.page.waitForFunction(
        () => document.querySelector('video')?.error !== null,
      )
      await failed.page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      )
      assert.equal(
        await failed.page
          .locator('video')
          .evaluate((video) => getComputedStyle(video).visibility),
        'hidden',
      )
      assert.equal(
        await failed.page.locator('img').evaluate((image) => {
          if (!(image instanceof HTMLImageElement)) {
            throw new Error('Expected the hero still image')
          }
          return image.complete
        }),
        true,
      )
      assert.equal(failed.videoRequests, 1)
      assert.deepEqual(failed.pageErrors, [])
      assert.ok(
        failed.consoleErrors.some((message) =>
          message.includes('Unable to play the homepage hero animation'),
        ),
      )
      await failed.page.close()
    } finally {
      await browser.close()
    }
  },
)
