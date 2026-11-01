import type { BreadcrumbItem } from '~/components/Breadcrumbs'

export function getDocsBreadcrumbItems({
  doc,
  library,
  canonicalHref,
}: {
  doc: { title: string } | undefined
  library: { id: string; name: string; visible?: boolean }
  canonicalHref: string
}): Array<BreadcrumbItem> | undefined {
  if (!doc?.title || library.visible === false) return undefined
  return [
    { label: 'Libraries', to: '/libraries' },
    { label: library.name, to: `/${library.id}/latest` },
    { label: doc.title, to: canonicalHref },
  ]
}
