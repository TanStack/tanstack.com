const LOW_VALUE_DOCS_SITEMAP_SEGMENTS = new Set([
  'examples',
  'community',
  'contributing',
  'superpowers',
])

const LOW_VALUE_DOCS_SITEMAP_SLUGS = new Set([
  'community-resources',
  'contributors',
  'npm-stats',
])

export function isHighValueDocsSlug(slug: string) {
  const segments = slug.split('/').filter(Boolean)

  return (
    segments.length > 0 &&
    !segments.some((segment) =>
      /^(?:drafts|readme)$|\.draft$/i.test(segment),
    ) &&
    !segments.some((segment) => LOW_VALUE_DOCS_SITEMAP_SEGMENTS.has(segment)) &&
    !LOW_VALUE_DOCS_SITEMAP_SLUGS.has(slug)
  )
}
