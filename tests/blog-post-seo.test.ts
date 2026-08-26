import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { allMaintainers } from '../src/libraries/maintainers'
import {
  getBlogAuthorIdentities,
  isBlogPostUnpublished,
} from '../src/utils/blog-format'
import {
  type BlogPostHeadData,
  getBlogPostHead,
  getBlogSocialImageUrl,
} from '../src/utils/blog-post-seo'
import {
  getTanStackOrganizationJsonLd,
  TANSTACK_ORGANIZATION_ID,
} from '../src/utils/organization-structured-data'

Object.assign(globalThis, {
  __TANSTACK_ENABLE_IMAGE_TRANSFORMATIONS__: true,
  __TANSTACK_SITE_URL__: 'https://tanstack.com',
})

type MetaTag = ReturnType<typeof getBlogPostHead>['meta'][number]
type JsonLdNode = Record<string, unknown>

const basePost: BlogPostHeadData = {
  authorIdentities: getBlogAuthorIdentities(['TkDodo'], allMaintainers),
  authors: ['TkDodo'],
  description: 'A representative article description.',
  isUnpublished: false,
  published: '2026-08-01',
  slug: 'structured-data-test',
  socialImage: 'https://tanstack.com/blog-assets/test/header.png',
  title: 'Structured Data Test',
}

function hasMetaTag(
  meta: Array<MetaTag>,
  attribute: 'name' | 'property',
  value: string,
  content?: string,
) {
  return meta.some(
    (tag) =>
      attribute in tag &&
      tag[attribute] === value &&
      (content === undefined || tag.content === content),
  )
}

function getJsonLd(head: ReturnType<typeof getBlogPostHead>) {
  assert.equal(head.scripts.length, 1)
  return JSON.parse(head.scripts[0]!.children) as {
    '@context': string
    '@graph': Array<JsonLdNode>
  }
}

function findGraphNode(
  graph: Array<JsonLdNode>,
  type: 'BlogPosting' | 'Organization',
) {
  const node = graph.find((candidate) => candidate['@type'] === type)
  assert.ok(node, `expected a ${type} node`)
  return node
}

test('published posts emit article metadata and connected BlogPosting JSON-LD', () => {
  const head = getBlogPostHead(basePost)
  const jsonLd = getJsonLd(head)
  const organization = findGraphNode(jsonLd['@graph'], 'Organization')
  const article = findGraphNode(jsonLd['@graph'], 'BlogPosting')

  assert.equal(jsonLd['@context'], 'https://schema.org')
  assert.deepEqual(organization, getTanStackOrganizationJsonLd())
  assert.deepEqual(article.publisher, { '@id': TANSTACK_ORGANIZATION_ID })
  assert.deepEqual(article.mainEntityOfPage, {
    '@type': 'WebPage',
    '@id': 'https://tanstack.com/blog/structured-data-test',
  })
  assert.equal(article.headline, basePost.title)
  assert.equal(article.description, basePost.description)
  assert.equal(article.datePublished, basePost.published)
  assert.equal('dateModified' in article, false)
  assert.equal(article.image, basePost.socialImage)
  assert.deepEqual(article.author, [
    {
      '@type': 'Person',
      name: 'Dominik Dorfmeister',
      url: 'https://github.com/tkdodo',
    },
  ])

  assert.equal(hasMetaTag(head.meta, 'property', 'og:type', 'article'), true)
  assert.equal(
    hasMetaTag(
      head.meta,
      'property',
      'article:published_time',
      basePost.published,
    ),
    true,
  )
  assert.equal(
    hasMetaTag(head.meta, 'name', 'author', 'Dominik Dorfmeister'),
    true,
  )
})

test('multiple authors are normalized and retain verified maintainer URLs', () => {
  const authorIdentities = getBlogAuthorIdentities(
    ['TkDodo', 'Tanner Linsley', 'TkDodo'],
    allMaintainers,
  )
  const head = getBlogPostHead({
    ...basePost,
    authorIdentities,
    authors: authorIdentities.map((author) => author.name),
  })
  const article = findGraphNode(getJsonLd(head)['@graph'], 'BlogPosting')

  assert.deepEqual(article.author, [
    {
      '@type': 'Person',
      name: 'Dominik Dorfmeister',
      url: 'https://github.com/tkdodo',
    },
    {
      '@type': 'Person',
      name: 'Tanner Linsley',
      url: 'https://github.com/tannerlinsley',
    },
  ])
  assert.equal(
    hasMetaTag(
      head.meta,
      'name',
      'author',
      'co-authored by Dominik Dorfmeister and Tanner Linsley',
    ),
    true,
  )
})

test('unknown authors get names without unverified profile URLs', () => {
  const authorIdentities = getBlogAuthorIdentities(
    ['Niall Crosby'],
    allMaintainers,
  )
  const article = findGraphNode(
    getJsonLd(
      getBlogPostHead({
        ...basePost,
        authorIdentities,
        authors: ['Niall Crosby'],
      }),
    )['@graph'],
    'BlogPosting',
  )

  assert.deepEqual(article.author, [
    {
      '@type': 'Person',
      name: 'Niall Crosby',
    },
  ])
})

test('posts without header images omit image metadata instead of inventing one', () => {
  const head = getBlogPostHead({ ...basePost, socialImage: undefined })
  const article = findGraphNode(getJsonLd(head)['@graph'], 'BlogPosting')

  assert.equal('image' in article, false)
  assert.equal(hasMetaTag(head.meta, 'property', 'og:image'), false)
  assert.equal(getBlogSocialImageUrl(undefined), undefined)
})

test('social images reuse the route image transformation and stay absolute', () => {
  assert.equal(
    getBlogSocialImageUrl('/blog-assets/test/header.png'),
    'https://tanstack.com/cdn-cgi/image/width=1200,height=630,fit=cover,quality=80,format=auto/blog-assets/test/header.png',
  )
  assert.equal(
    getBlogSocialImageUrl('https://images.example.com/post.png'),
    'https://images.example.com/post.png',
  )
})

test('drafts, future posts, and failed loads do not emit BlogPosting JSON-LD', () => {
  assert.equal(
    isBlogPostUnpublished({ draft: true, published: '2026-08-01' }),
    true,
  )
  assert.equal(isBlogPostUnpublished({ published: '2099-01-01' }), true)
  assert.equal(isBlogPostUnpublished({ published: '2020-01-01' }), false)

  const unpublishedHead = getBlogPostHead({
    ...basePost,
    isUnpublished: true,
  })
  assert.deepEqual(unpublishedHead.scripts, [])
  assert.equal(
    hasMetaTag(unpublishedHead.meta, 'name', 'robots', 'noindex, nofollow'),
    true,
  )
  assert.deepEqual(getBlogPostHead(undefined), { meta: [], scripts: [] })
})

test('known modification dates reach frontmatter, JSON-LD, and article metadata', () => {
  for (const slug of [
    'incident-followup',
    'npm-supply-chain-compromise-postmortem',
  ]) {
    assert.match(
      readFileSync(new URL(`../src/blog/${slug}.md`, import.meta.url), 'utf8'),
      /^updated: 2026-05-15$/m,
    )
  }

  const updatedPost = { ...basePost, updated: '2026-08-10' }
  const head = getBlogPostHead(updatedPost)
  const article = findGraphNode(getJsonLd(head)['@graph'], 'BlogPosting')

  assert.equal(article.dateModified, updatedPost.updated)
  assert.equal(
    hasMetaTag(
      head.meta,
      'property',
      'article:modified_time',
      updatedPost.updated,
    ),
    true,
  )
})
