import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

// Run against the local dev server: node scripts/test-builder-passkey-submit.mjs
const origin = process.env.BUILDER_TEST_ORIGIN ?? 'http://127.0.0.1:3008'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  await page.addInitScript(() => {
    class Passkey {
      rawId = new Uint8Array([1]).buffer
      getClientExtensionResults() {
        return {
          prf: { enabled: true, results: { first: new Uint8Array(32) } },
        }
      }
    }
    window.passkeyCalls = 0
    Object.defineProperty(window, 'PublicKeyCredential', { value: Passkey })
    Object.defineProperty(navigator, 'credentials', {
      value: {
        async create() {
          return new Passkey()
        },
        get() {
          window.passkeyCalls += 1
          return new Promise((resolve, reject) => {
            window.cancelPasskey = () =>
              reject(new Error('Cancelled test passkey'))
            window.unlockPasskey = () => resolve(new Passkey())
          })
        },
      },
    })
  })
  await page.goto(`${origin}/builder/ai`)
  await page.evaluate(async () => {
    const base = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(32),
      'HKDF',
      false,
      ['deriveKey'],
    )
    const key = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(0),
        info: new TextEncoder().encode('byok:keyring:v1'),
      },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    )
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(
        JSON.stringify({ openai: 'sk-test-not-a-real-key' }),
      ),
    )
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(
        'tanstack-builder-ai:byok:v1:local-spike',
        1,
      )
      request.onupgradeneeded = () =>
        request.result.createObjectStore('keyring', { keyPath: 'id' })
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const tx = request.result.transaction('keyring', 'readwrite')
        tx.objectStore('keyring').put({
          id: 'default',
          credentialId: new Uint8Array([1]).buffer,
          salt: new Uint8Array(32).buffer,
          iv: iv.buffer,
          ciphertext,
          preview: { openai: '-key' },
        })
        tx.oncomplete = () => {
          request.result.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
  })
  await page.reload()
  const composer = page.locator('#builder-ai-prompt')
  await composer.waitFor({ timeout: 60_000 })
  await composer.pressSequentially('Keep this draft after a cancelled unlock', {
    delay: 30,
  })
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  await page.waitForFunction(() => window.passkeyCalls === 1)
  assert.equal(await composer.isDisabled(), true)
  await page
    .locator('form')
    .filter({ has: composer })
    .evaluate((form) => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
    })
  assert.equal(await page.evaluate(() => window.passkeyCalls), 1)
  await page.evaluate(() => window.cancelPasskey())
  await page.waitForFunction(
    () => !document.querySelector('#builder-ai-prompt').disabled,
  )
  assert.equal(
    await composer.inputValue(),
    'Keep this draft after a cancelled unlock',
  )

  console.log('Builder passkey submission checks passed')
} finally {
  await browser.close()
}
