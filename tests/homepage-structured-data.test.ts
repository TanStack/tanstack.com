import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  TANSTACK_ORGANIZATION_ID,
  TANSTACK_WEBSITE_ID,
  getTanStackHomepageJsonLd,
  getTanStackOrganizationJsonLd,
} from '../src/utils/organization-structured-data'

test('homepage connects one WebSite to one Organization', () => {
  const structuredData = getTanStackHomepageJsonLd()
  const websites = structuredData['@graph'].filter(
    (node) => node['@type'] === 'WebSite',
  )
  const organizations = structuredData['@graph'].filter(
    (node) => node['@type'] === 'Organization',
  )

  assert.equal(structuredData['@context'], 'https://schema.org')
  assert.equal(websites.length, 1)
  assert.equal(organizations.length, 1)
  assert.deepEqual(websites[0], {
    '@type': 'WebSite',
    '@id': TANSTACK_WEBSITE_ID,
    name: 'TanStack',
    url: 'https://tanstack.com/',
    publisher: {
      '@id': TANSTACK_ORGANIZATION_ID,
    },
  })
  assert.deepEqual(organizations[0], getTanStackOrganizationJsonLd())
})

test('homepage Organization uses a square logo and verified profiles', () => {
  const organization = getTanStackOrganizationJsonLd()

  assert.deepEqual(organization.logo, {
    '@type': 'ImageObject',
    '@id': 'https://tanstack.com/#organization-logo',
    url: 'https://tanstack.com/images/brand/social/stacked-green@2x.png',
    contentUrl: 'https://tanstack.com/images/brand/social/stacked-green@2x.png',
    width: 800,
    height: 800,
  })
  assert.deepEqual(organization.sameAs, [
    'https://github.com/TanStack',
    'https://x.com/tan_stack',
    'https://bsky.app/profile/tanstack.com',
    'https://youtube.com/@tan_stack',
  ])
})

test('homepage does not advertise a site search action', () => {
  const serialized = JSON.stringify(getTanStackHomepageJsonLd())

  assert.equal(serialized.includes('SearchAction'), false)
  assert.equal(serialized.includes('potentialAction'), false)
})
