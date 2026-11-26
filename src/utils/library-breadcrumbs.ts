import type { BreadcrumbItem } from '~/components/Breadcrumbs'
import { canonicalUrl } from './seo'

type LibraryBreadcrumbData = { name: string; to?: string; visible?: boolean }

export function getLibraryBreadcrumbItems(
  library: LibraryBreadcrumbData,
): Array<BreadcrumbItem> | undefined {
  if (library.visible === false || !library.to) return undefined
  return [
    { label: 'Libraries', to: '/libraries' },
    { label: library.name, to: library.to },
  ]
}

export function getLibraryBreadcrumbJsonLd(library: LibraryBreadcrumbData) {
  const items = getLibraryBreadcrumbItems(library)
  if (!items) return undefined
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: canonicalUrl(item.to),
    })),
  }
}
