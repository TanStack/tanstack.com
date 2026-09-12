import type { readDocsFreshness } from './docs-freshness'
import {
  getTanStackOrganizationJsonLd,
  TANSTACK_ORGANIZATION_ID,
} from './organization-structured-data'
import { canonicalUrl } from './seo'

export function getDocsStructuredData({
  doc,
  library,
  canonicalHref,
}: {
  doc:
    | {
        title: string
        description?: string
        freshness?: ReturnType<typeof readDocsFreshness>
      }
    | undefined
  library: { id: string; name: string; visible?: boolean }
  canonicalHref: string
}) {
  if (!doc?.title || library.visible === false) return undefined

  return {
    '@context': 'https://schema.org',
    '@graph': [
      getTanStackOrganizationJsonLd(),
      {
        '@type': 'WebPage',
        '@id': canonicalHref,
        url: canonicalHref,
        name: doc.title,
        ...(doc.description ? { description: doc.description } : {}),
        breadcrumb: { '@id': `${canonicalHref}#breadcrumb` },
        mainEntity: { '@id': `${canonicalHref}#article` },
      },
      {
        '@type': 'TechArticle',
        '@id': `${canonicalHref}#article`,
        headline: doc.title,
        ...(doc.description ? { description: doc.description } : {}),
        mainEntityOfPage: { '@id': canonicalHref },
        publisher: { '@id': TANSTACK_ORGANIZATION_ID },
        ...(doc.freshness?.updated
          ? { dateModified: doc.freshness.updated }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalHref}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: library.name,
            item: canonicalUrl(`/${library.id}/latest`),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: doc.title,
            item: canonicalHref,
          },
        ],
      },
    ],
  }
}
