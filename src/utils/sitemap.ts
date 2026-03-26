import { getBranch, libraries } from '~/libraries'
import type { LibrarySlim } from '~/libraries/types'
import { getPublishedPosts } from '~/utils/blog'
import { fetchRepoDirectoryContents } from '~/utils/docs'
import type { GitHubFileNode } from '~/utils/documents.server'
import { env } from '~/utils/env'

const TOP_LEVEL_ROUTE_MODULES = Object.keys(
  import.meta.glob('../routes/*.{ts,tsx}'),
)

const TOP_LEVEL_INDEX_ROUTE_MODULES = Object.keys(
  import.meta.glob('../routes/*/index.tsx'),
)

export type SitemapEntry = {
  path: string
  lastModified?: string
}

const MAX_DOCS_SITEMAP_DEPTH = 3

const EXCLUDED_TOP_LEVEL_ROUTE_NAMES = new Set([
  '__root',
  'account',
  'ads',
  'blog.$',
  'brand-guide',
  'builder.docs',
  'dashboard',
  'feed',
  'feedback-leaderboard',
  'llms.txt',
  'login',
  'merch',
  'partners-embed',
  'privacy',
  'terms',
  'robots.txt',
  'rss.xml',
  'sitemap.xml',
  'sponsors-embed',
])

const EXCLUDED_TOP_LEVEL_ROUTE_DIRECTORIES = new Set([
  '$libraryId',
  '[.]well-known',
  'account',
  'admin',
  'stats',
])

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

function normalizeRouteName(routeName: string) {
  return routeName.replace(/\[\.\]/g, '.')
}

function getTopLevelRoutePath(routeName: string) {
  if (routeName === 'index') {
    return '/'
  }

  if (routeName.endsWith('.index')) {
    return `/${routeName.slice(0, -'.index'.length)}`
  }

  return `/${routeName}`
}

function getTopLevelEntries(): Array<SitemapEntry> {
  const fileEntries = TOP_LEVEL_ROUTE_MODULES.flatMap((modulePath) => {
    const routeName = normalizeRouteName(
      modulePath
        .split('/')
        .at(-1)
        ?.replace(/\.(ts|tsx)$/, '') ?? '',
    )

    if (!routeName || EXCLUDED_TOP_LEVEL_ROUTE_NAMES.has(routeName)) {
      return []
    }

    return [{ path: getTopLevelRoutePath(routeName) }]
  })

  const directoryEntries = TOP_LEVEL_INDEX_ROUTE_MODULES.flatMap(
    (modulePath) => {
      const routeDirectory = modulePath.split('/').at(-2)

      if (
        !routeDirectory ||
        EXCLUDED_TOP_LEVEL_ROUTE_DIRECTORIES.has(routeDirectory)
      ) {
        return []
      }

      return [{ path: `/${normalizeRouteName(routeDirectory)}` }]
    },
  )

  return [...fileEntries, ...directoryEntries]
}

function getLibraryEntries(): Array<SitemapEntry> {
  return libraries.flatMap((library) => {
    if (
      library.visible === false ||
      !library.latestVersion ||
      library.sitemap?.includeLandingPage !== true
    ) {
      return []
    }

    const basePath = `/${library.id}/latest`
    return [{ path: basePath }]
  })
}

function flattenDocsTree(nodes: Array<GitHubFileNode>): Array<GitHubFileNode> {
  return nodes.flatMap((node) => [
    node,
    ...(node.children ? flattenDocsTree(node.children) : []),
  ])
}

function toDocsSlug(filePath: string, docsRoot: string) {
  const docsPrefix = `${docsRoot}/`

  if (!filePath.startsWith(docsPrefix) || !filePath.endsWith('.md')) {
    return null
  }

  const slug = filePath.slice(docsPrefix.length, -'.md'.length)

  if (!slug || slug.endsWith('/index')) {
    return null
  }

  return slug
}

function isTopLevelDocsSlug(slug: string) {
  const segments = slug.split('/')

  return segments.length <= MAX_DOCS_SITEMAP_DEPTH
}

function isDefined<T>(value: T | null): value is T {
  return value !== null
}

async function getLibraryDocsEntries(
  library: LibrarySlim,
): Promise<Array<SitemapEntry>> {
  if (
    library.visible === false ||
    !library.latestVersion ||
    library.sitemap?.includeTopLevelDocsPages !== true
  ) {
    return []
  }

  const docsRoot = library.docsRoot || 'docs'
  const branch = getBranch(library, 'latest')
  const docsTree = await fetchRepoDirectoryContents({
    data: {
      repo: library.repo,
      branch,
      startingPath: docsRoot,
    },
  }).catch(() => [])

  return flattenDocsTree(docsTree)
    .filter((node) => node.type === 'file')
    .map((node) => toDocsSlug(node.path, docsRoot))
    .filter(isDefined)
    .filter(isTopLevelDocsSlug)
    .map((slug) => ({
      path: `/${library.id}/latest/docs/${slug}`,
    }))
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

export async function getSitemapEntries(): Promise<Array<SitemapEntry>> {
  const docsEntries = await Promise.all(
    libraries.map((library) => getLibraryDocsEntries(library)),
  )

  const entries = [
    ...getTopLevelEntries(),
    ...getLibraryEntries(),
    ...docsEntries.flat(),
    ...getBlogEntries(),
  ]

  return Array.from(
    new Map(entries.map((entry) => [entry.path, entry])).values(),
  )
}

export async function generateSitemapXml(origin: string) {
  const urls = (await getSitemapEntries())
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
    'Disallow: /api/',
    'Disallow: /oauth/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
  ].join('\n')
}
