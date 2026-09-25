import assert from 'node:assert/strict'
import test from 'node:test'
import { router } from '../src/libraries'
import {
  getFrameworkDocsHash,
  getFrameworkDocsPath,
} from '../src/libraries/frameworkSupport'

for (const framework of router.frameworks) {
  test(`Router's emitted install href for ${framework} is the canonical quick-start doc`, () => {
    const docsPath = getFrameworkDocsPath(framework, router)

    assert.equal(
      docsPath,
      'quick-start',
      `Router install path for ${framework} should point at the canonical ` +
      `quick-start doc, not a framework-nested path that doesn't exist`,
    )
    assert.doesNotMatch(
      docsPath,
      /^framework\//,
      'Router install path must not be framework-nested (no matching doc exists)',
    )
  })

  test(`Router's emitted install hash for ${framework} is unset`, () => {
    assert.equal(getFrameworkDocsHash(framework, router), undefined)
  })
}
