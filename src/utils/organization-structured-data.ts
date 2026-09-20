import { SITE_URL } from '~/utils/site'

const siteUrl = `${SITE_URL.replace(/\/$/, '')}/`

export const TANSTACK_ORGANIZATION_ID = `${siteUrl}#organization`
export const TANSTACK_WEBSITE_ID = `${siteUrl}#website`

export function getTanStackWebsiteJsonLd() {
  return {
    '@type': 'WebSite' as const,
    '@id': TANSTACK_WEBSITE_ID,
    name: 'TanStack',
    url: siteUrl,
    publisher: {
      '@id': TANSTACK_ORGANIZATION_ID,
    },
  }
}

export function getTanStackOrganizationJsonLd() {
  return {
    '@type': 'Organization' as const,
    '@id': TANSTACK_ORGANIZATION_ID,
    name: 'TanStack',
    url: siteUrl,
    logo: {
      '@type': 'ImageObject' as const,
      '@id': `${siteUrl}#organization-logo`,
      url: `${siteUrl}images/brand/social/stacked-light@2x.png`,
      contentUrl: `${siteUrl}images/brand/social/stacked-light@2x.png`,
      width: 800,
      height: 800,
    },
    sameAs: [
      'https://github.com/TanStack',
      'https://x.com/tan_stack',
      'https://bsky.app/profile/tanstack.com',
      'https://youtube.com/@tan_stack',
      'https://www.linkedin.com/company/tanstack',
    ],
  }
}

export function getTanStackHomepageJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [getTanStackWebsiteJsonLd(), getTanStackOrganizationJsonLd()],
  }
}
