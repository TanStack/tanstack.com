import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import postgres from 'postgres'
import { chromium } from 'playwright-core'

// Opt in with an isolated local database and preview server. Never use production.
const databaseUrl = process.env.SHOWCASE_TEST_DATABASE_URL
const previewUrl = process.env.SHOWCASE_TEST_PREVIEW_URL?.replace(/\/+$/, '')
const browserPath = process.env.SHOWCASE_TEST_BROWSER_PATH
const secret = process.env.SHOWCASE_TEST_SESSION_SECRET

test(
  'showcase placement, privacy, review controls, and resubmission',
  {
    skip: !databaseUrl || !previewUrl || !secret || !browserPath,
    timeout: 180_000,
  },
  async () => {
    assert.ok(databaseUrl && previewUrl && secret && browserPath)
    assert.equal(new URL(databaseUrl).hostname, '127.0.0.1')
    assert.equal(new URL(previewUrl).hostname, '127.0.0.1')
    const sql = postgres(databaseUrl, { max: 1 })
    const ownerId = randomUUID()
    const moderatorId = randomUUID()
    const curatedId = randomUUID()
    const communityId = randomUUID()
    const hiddenId = randomUUID()
    const pendingId = randomUUID()
    const browser = await chromium.launch({
      executablePath: browserPath,
      headless: true,
    })
    const context = await browser.newContext()
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === new URL(previewUrl).origin
        ? route.continue()
        : route.abort(),
    )
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    const signIn = async (userId: string) => {
      const payload = Buffer.from(
        `${userId}:${Date.now() + 3600000}:0`,
      ).toString('base64url')
      const signature = createHmac('sha256', secret)
        .update(payload)
        .digest('base64url')
      await context.addCookies([
        {
          name: 'session_token',
          value: `${payload}.${signature}`,
          url: previewUrl,
        },
      ])
    }
    try {
      await sql`INSERT INTO users (id, email, name, capabilities) VALUES
      (${ownerId}, ${`${ownerId}@example.invalid`}, 'Review test owner', '{}'),
      (${moderatorId}, ${`${moderatorId}@example.invalid`}, 'Review test moderator', '{moderate-showcases}')`
      for (const [id, name, status, placement] of [
        [curatedId, 'Review test Showcase', 'approved', 'showcase'],
        [communityId, 'Review test Community', 'approved', 'community'],
        [hiddenId, 'Review test Private', 'approved', 'private'],
        [pendingId, 'Review test Pending', 'pending', 'private'],
      ]) {
        await sql`INSERT INTO showcases (id, user_id, name, tagline, url, screenshot_url, source_url, libraries, status, placement, moderation_note, review_reason)
        VALUES (${id}, ${ownerId}, ${name}, 'A project for publication testing', 'https://example.org/', ${`${previewUrl}/blog-assets/streaming-structured-output/header.png`}, 'https://github.com/example/project', '{query}', ${status}, ${placement}, 'INTERNAL-NOTE-MUST-NOT-LEAK', 'INTERNAL-REASON-MUST-NOT-LEAK')`
      }
      await page.goto(`${previewUrl}/showcase?q=Review%20test`)
      await page
        .getByRole('heading', { name: 'Review test Showcase', exact: true })
        .waitFor()
      assert.equal(
        await page
          .getByRole('heading', { name: 'Review test Community', exact: true })
          .count(),
        0,
      )
      assert.equal(
        await page
          .getByRole('heading', { name: 'Review test Private', exact: true })
          .count(),
        0,
      )
      assert.ok(!(await page.content()).includes('INTERNAL-NOTE-MUST-NOT-LEAK'))
      await page.screenshot({
        path: join(tmpdir(), 'showcase-curated-preview.png'),
        fullPage: true,
      })

      await page.goto(`${previewUrl}/community-projects?q=Review%20test`)
      await page
        .getByRole('heading', { name: 'Review test Community', exact: true })
        .waitFor()
      assert.equal(
        await page
          .getByRole('heading', { name: 'Review test Showcase', exact: true })
          .count(),
        0,
      )
      assert.match(
        (await page.locator('meta[name="robots"]').getAttribute('content')) ||
          '',
        /noindex/,
      )
      const outbound = page.locator('a[href="https://example.org/"]')
      assert.match((await outbound.getAttribute('rel')) || '', /ugc/)
      assert.match((await outbound.getAttribute('rel')) || '', /nofollow/)
      await page.screenshot({
        path: join(tmpdir(), 'showcase-community-preview.png'),
        fullPage: true,
      })
      await page.setViewportSize({ width: 390, height: 844 })
      await page.screenshot({
        path: join(tmpdir(), 'showcase-community-mobile.png'),
        fullPage: true,
      })
      await page.setViewportSize({ width: 1280, height: 900 })

      await page.goto(`${previewUrl}/showcase/${communityId}`)
      await page
        .getByRole('heading', { name: 'Review test Community', exact: true })
        .waitFor()
      assert.match(
        (await page.locator('meta[name="robots"]').getAttribute('content')) ||
          '',
        /noindex/,
      )
      assert.match(
        (await page
          .getByRole('link', { name: 'Visit Site', exact: true })
          .getAttribute('rel')) || '',
        /ugc.*nofollow/,
      )
      assert.ok(
        !(await page.content()).includes('INTERNAL-REASON-MUST-NOT-LEAK'),
      )
      for (const id of [hiddenId, pendingId]) {
        const response = await page.goto(`${previewUrl}/showcase/${id}`)
        assert.equal(response?.status(), 404)
        assert.ok(!(await page.content()).includes('https://example.org/'))
      }

      await signIn(ownerId)
      await page.goto(`${previewUrl}/showcase/${hiddenId}`)
      await page
        .getByRole('heading', { name: 'Review test Private', exact: true })
        .waitFor()
      assert.match(
        (await page.locator('meta[name="robots"]').getAttribute('content')) ||
          '',
        /noindex/,
      )
      assert.ok(!(await page.content()).includes('INTERNAL-NOTE-MUST-NOT-LEAK'))

      await signIn(moderatorId)
      await page.goto(`${previewUrl}/admin/showcases/${communityId}`)
      await page
        .getByRole('button', { name: 'Edit review and placement' })
        .click()
      await page
        .getByLabel('Placement', { exact: true })
        .selectOption('private')
      await page
        .getByLabel('Reason for this decision')
        .fill('The submitted destination needs correction.')
      await page.screenshot({
        path: join(tmpdir(), 'showcase-review-editor.png'),
        fullPage: true,
      })
      await page.getByRole('button', { name: 'Save Changes' }).click()
      await page
        .getByRole('button', { name: 'Edit review and placement' })
        .waitFor()
      const [saved] =
        await sql`SELECT status, placement, review_reason, moderated_by FROM showcases WHERE id = ${communityId}`
      assert.equal(saved.status, 'approved')
      assert.equal(saved.placement, 'private')
      assert.equal(saved.moderated_by, moderatorId)
      assert.equal(
        saved.review_reason,
        'The submitted destination needs correction.',
      )
      const [audit] =
        await sql`SELECT details FROM audit_logs WHERE target_id = ${communityId} ORDER BY created_at DESC LIMIT 1`
      assert.equal(audit.details.after.placement, 'private')

      await page
        .getByRole('button', { name: 'Edit review and placement' })
        .click()
      await sql`UPDATE showcases SET tagline = 'Changed by another moderator', updated_at = now() + interval '1 second' WHERE id = ${communityId}`
      await page
        .getByLabel('Reason for this decision')
        .fill('This stale save must be refused.')
      await page.getByRole('button', { name: 'Save Changes' }).click()
      await page
        .getByText(
          'This project changed since you opened it. Reload before saving.',
          { exact: true },
        )
        .waitFor()
      const [concurrent] =
        await sql`SELECT tagline, review_reason FROM showcases WHERE id = ${communityId}`
      assert.equal(concurrent.tagline, 'Changed by another moderator')
      assert.equal(
        concurrent.review_reason,
        'The submitted destination needs correction.',
      )

      await signIn(ownerId)
      await page.goto(`${previewUrl}/showcase/edit/${curatedId}`)
      await page.waitForLoadState('networkidle')
      await page
        .getByLabel('Tagline', { exact: false })
        .fill('Updated project description')
      page.once('dialog', (dialog) => dialog.accept())
      await page.getByRole('button', { name: /Save|Update/ }).click()
      await page.waitForURL('**/account/submissions')
      const [edited] =
        await sql`SELECT status, placement, moderation_note FROM showcases WHERE id = ${curatedId}`
      assert.equal(edited.status, 'pending')
      assert.equal(edited.placement, 'private')
      assert.equal(edited.moderation_note, 'INTERNAL-NOTE-MUST-NOT-LEAK')
    } catch (error) {
      console.error(
        await page
          .locator('body')
          .innerText({ timeout: 2000 })
          .then((text) => text.slice(-6000))
          .catch(() => 'Page diagnostics unavailable'),
      )
      throw error
    } finally {
      try {
        await browser.close()
      } finally {
        try {
          await sql`DELETE FROM audit_logs WHERE actor_id IN (${ownerId}, ${moderatorId})`
          await sql`DELETE FROM users WHERE id IN (${ownerId}, ${moderatorId})`
        } finally {
          await sql.end()
        }
      }
    }
  },
)
