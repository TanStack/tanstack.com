import assert from 'node:assert/strict'
import { test } from 'node:test'
import { libraries } from '../src/libraries/libraries'
import { getLibraryLandingSitemapEntries } from '../src/utils/library-sitemap'

test('library sitemap entries only expose latest landing pages', () => {
  const expectedPaths = libraries
    .filter(
      (library) =>
        library.visible !== false &&
        library.latestVersion &&
        library.sitemap?.includeLandingPage === true,
    )
    .map((library) => `/${library.id}/latest`)

  assert.deepEqual(
    getLibraryLandingSitemapEntries().map((entry) => entry.path),
    expectedPaths,
  )
})
