import assert from 'node:assert/strict'
import test from 'node:test'
import { charts, getBranch, highlight, markdown } from '../src/libraries'
import { validateLibraryVersion } from '../src/routes/-library-landing'

for (const library of [markdown, highlight, charts]) {
  test(`${library.id} v1 picker uses the current docs branch and retires v0`, () => {
    assert.equal(library.badge, undefined)
    assert.equal(library.latestVersion, 'v1')
    assert.deepEqual(library.availableVersions, ['v1'])
    assert.equal(getBranch(library, 'v1'), 'main')
    assert.equal(getBranch(library, 'latest'), 'main')

    const invalidVersion = () => {
      throw new Error('retired version')
    }
    for (const version of ['latest', 'v1']) {
      assert.equal(
        validateLibraryVersion(library.id, version, invalidVersion),
        library,
      )
    }
    assert.throws(
      () => validateLibraryVersion(library.id, 'v0', invalidVersion),
      /retired version/,
    )
  })
}

const baseUrl = process.env.TANSTACK_DOCS_SMOKE_BASE_URL

test(
  'Markdown, Highlight, and Charts v0 and v1 docs aliases preserve paths and query strings',
  {
    skip: baseUrl ? false : 'Set TANSTACK_DOCS_SMOKE_BASE_URL for route checks',
  },
  async () => {
    assert.ok(baseUrl)
    for (const library of [markdown, highlight, charts]) {
      for (const version of ['v0', 'v1']) {
        const response: Response = await fetch(
          new URL(
            `/${library.id}/${version}/docs/overview?test=version`,
            baseUrl,
          ),
          { redirect: 'manual', signal: AbortSignal.timeout(30_000) },
        )
        assert.equal(response.status, 308)
        const location = response.headers.get('location')
        assert.ok(location)
        const target = new URL(location, baseUrl)
        assert.equal(target.pathname, `/${library.id}/latest/docs/overview`)
        assert.equal(target.search, '?test=version')
      }
      const response: Response = await fetch(
        new URL(`/${library.id}/latest/docs/overview`, baseUrl),
        { signal: AbortSignal.timeout(30_000) },
      )
      assert.equal(response.status, 200)
      assert.match(await response.text(), /v1/)
    }
  },
)
