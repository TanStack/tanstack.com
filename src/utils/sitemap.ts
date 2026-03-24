import { libraries } from '~/libraries'
import { getPublishedPosts } from '~/utils/blog'
import { env } from '~/utils/env'

export type SitemapEntry = {
  path: string
  lastModified?: string
}

const HIGH_VALUE_STATIC_SITEMAP_PATHS = [
  '/',
  '/blog',
  '/libraries',
  '/learn',
  '/showcase',
  '/support',
  '/partners',
  '/workshops',
  '/maintainers',
  '/builder',
  '/explore',
  '/ethos',
  '/tenets',
] as const satisfies ReadonlyArray<string>

function trimTrailingSlash(url: string) {
  return url.replace(/\/$/, '')
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function asLastModified(value: string) {
  return new Date(`${value}T12:00:00.000Z`).toISOString()
}

function getLibraryEntries(): Array<SitemapEntry> {
  return libraries.flatMap((library) => {
    if (library.visible === false || !library.latestVersion) {
      return []
    }

    const basePath = `/${library.id}/latest`
    const entries: Array<SitemapEntry> = [{ path: basePath }]

    if (library.defaultDocs) {
      entries.push({
        path: `${basePath}/docs/${library.defaultDocs}`,
      })
    }

    return entries
  })
}

function getBlogEntries(): Array<SitemapEntry> {
  return getPublishedPosts().map((post) => ({
    path: `/blog/${post.slug}`,
    lastModified: asLastModified(post.published),
  }))
}

export function getSiteOrigin(request: Request) {
  return trimTrailingSlash(env.SITE_URL || new URL(request.url).origin)
}

export function getSitemapEntries(): Array<SitemapEntry> {
  const entries = [
    ...HIGH_VALUE_STATIC_SITEMAP_PATHS.map((path) => ({ path })),
    ...getLibraryEntries(),
    ...getBlogEntries(),
  ]

  return Array.from(
    new Map(entries.map((entry) => [entry.path, entry])).values(),
  )
}

export function generateSitemapXml(origin: string) {
  const urls = getSitemapEntries()
    .map((entry) => {
      const loc = `${origin}${entry.path}`

      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        entry.lastModified
          ? `    <lastmod>${entry.lastModified}</lastmod>`
          : '',
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

export function generateRobotsTxt(origin: string) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /account',
    'Disallow: /api',
    'Disallow: /oauth',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
  ].join('\n')
}
