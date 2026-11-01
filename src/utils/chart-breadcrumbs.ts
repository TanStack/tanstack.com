import type { BreadcrumbItem } from '~/components/Breadcrumbs'
import { findChartsCatalogCollection } from './charts-catalog'
import { canonicalUrl } from './seo'

type ChartBreadcrumbData = { id: string; title: string; collection?: string }

export function getChartBreadcrumbItems(
  chart: ChartBreadcrumbData,
): Array<BreadcrumbItem> {
  const collection = chart.collection
    ? findChartsCatalogCollection(chart.collection)
    : undefined
  const items: Array<BreadcrumbItem> = [
    { label: 'Catalog', to: '/charts/catalog', search: true, preload: false },
  ]
  if (collection) {
    items.push({
      label: collection.title,
      to: `/charts/catalog/collections/${collection.id}`,
      search: true,
      preload: false,
    })
  }
  items.push({ label: chart.title, to: `/charts/catalog/charts/${chart.id}` })
  return items
}

export function getChartBreadcrumbJsonLd(chart: ChartBreadcrumbData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: getChartBreadcrumbItems(chart).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: canonicalUrl(item.to),
    })),
  }
}
