import assert from 'node:assert/strict'
import test from 'node:test'
import { isHighValueDocsSlug } from '../src/utils/sitemap-docs'

test('sitemap excludes repository artifacts while retaining public guides', () => {
  for (const slug of [
    'how-to/drafts/README',
    'how-to/drafts/search-params-in-forms.draft',
    'how-to/README',
    'contributing',
    'contributing/oracle-reviews/issue-2034-design/candidate',
    'contributing/designs/source-failure-and-health/error-surface/RULES',
    'framework/react/contributing/maintainer-notes',
    'contributing/designs/source-failure/README',
    'guide.draft',
    'guides/readme',
  ]) {
    assert.equal(isHighValueDocsSlug(slug), false, slug)
  }
  for (const slug of [
    'overview',
    'framework/react/guides/query-keys',
    'guides/draft',
    'guides/readme-format',
  ]) {
    assert.equal(isHighValueDocsSlug(slug), true, slug)
  }
})
test('existing sitemap exclusions remain excluded', () => {
  for (const slug of [
    '',
    'examples/basic',
    'community/resources',
    'community-resources',
    'contributors',
    'npm-stats',
  ]) {
    assert.equal(isHighValueDocsSlug(slug), false, slug)
  }
})
