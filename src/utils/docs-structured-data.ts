import { getDocsBreadcrumbItems } from './docs-breadcrumbs'
import type { readDocsFreshness } from './docs-freshness'
import {
  getTanStackOrganizationJsonLd,
  TANSTACK_ORGANIZATION_ID,
} from './organization-structured-data'

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
  const items = getDocsBreadcrumbItems({ doc, library, canonicalHref })
  if (!doc?.title || !items) return undefined

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
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.label,
          item: new URL(item.to, canonicalHref).href,
        })),
      },
    ],
  }
}
