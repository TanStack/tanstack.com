import assert from 'node:assert/strict'
import { readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { libraries } from '../src/libraries/libraries'

// Use a local preview pointed at isolated fixture repositories, never a checkout.
const baseUrl = process.env.TANSTACK_SITEMAP_TEST_BASE_URL
const fixtureRoot = process.env.TANSTACK_SITEMAP_TEST_REPOS
const fixtureContent =
  '---\ntitle: Sitemap verification\n---\nSitemap verification fixture.\n'

test(
  'a sitemap source failure returns uncached 503 and recovers with all libraries',
  {
    skip: !baseUrl || !fixtureRoot,
    timeout: 120_000,
  },
  async () => {
    assert.ok(baseUrl && fixtureRoot)
    assert.equal(new URL(baseUrl).hostname, '127.0.0.1')
    const selected = libraries.filter(
      (library) =>
        library.visible !== false &&
        library.latestVersion &&
        library.sitemap?.includeDocsPages === true,
    )
    const target = selected.find((library) => library.id === 'start')
    assert.ok(target)
    const fixture = path.join(
      fixtureRoot,
      target.repo.split('/')[1],
      target.docsRoot || 'docs',
      'seo-completeness-probe.md',
    )
    const original = await readFile(fixture, 'utf8')
    assert.equal(
      original,
      fixtureContent,
      'only mutate the dedicated sitemap fixture',
    )
    const request = () =>
      fetch(new URL('/sitemap.xml', baseUrl), {
        signal: AbortSignal.timeout(30_000),
      })
    const assertComplete = async () => {
      const response = await request()
      assert.equal(response.status, 200)
      assert.match(
        response.headers.get('content-type') || '',
        /application\/xml/,
      )
      const xml = await response.text()
      for (const library of selected) {
        assert.ok(
          xml.includes(
            `<loc>https://tanstack.com/${library.id}/latest/docs/seo-completeness-probe</loc>`,
          ),
          library.id,
        )
      }
    }
    const expectFailure = async () => {
      const response = await request()
      assert.equal(response.status, 503)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(
        response.headers.get('cloudflare-cdn-cache-control'),
        'no-store',
      )
      assert.equal(response.headers.get('retry-after'), '60')
      assert.equal(await response.text(), 'Sitemap temporarily unavailable')
    }

    await assertComplete()
    await rename(fixture, `${fixture}.off`)
    try {
      await expectFailure()
    } finally {
      await rename(`${fixture}.off`, fixture)
    }
    await assertComplete()
    await writeFile(
      fixture,
      '---\ntitle: [invalid YAML\n---\nBroken fixture.\n',
    )
    try {
      await expectFailure()
    } finally {
      await writeFile(fixture, original)
    }
    await assertComplete()
  },
)
