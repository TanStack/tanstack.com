import { SITE_URL } from '~/utils/site'
import { findLibrary } from '~/libraries/libraries'

const NON_INDEXABLE_PATH_PREFIXES = [
  '/account',
  '/admin',
  '/login',
  '/partners-embed',
  '/sponsors-embed',
] as const

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, '')
}

function normalizePath(path: string) {
  if (!path || path === '/') {
    return '/'
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return normalizedPath.replace(/\/$/, '')
}

export function getCanonicalPath(path: string) {
  const normalizedPath = normalizePath(path)

  if (
    NON_INDEXABLE_PATH_PREFIXES.some(
      (prefix) =>
        normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
    )
  ) {
    return null
  }

  const [, libraryId, version, ...remainingSegments] = normalizedPath.split('/')
  const library = libraryId ? findLibrary(libraryId) : undefined

  // Numbered and historical landing pages render independently, but all of
  // them consolidate their indexing and social URL signals onto /latest.
  if (
    library?.availableVersions.concat('latest').includes(version!) &&
    remainingSegments.length === 0
  ) {
    return `/${library.id}/latest`
  }

  return normalizedPath
}

export function shouldIndexPath(path: string) {
  return getCanonicalPath(path) !== null
}

export function canonicalUrl(path: string, search?: string) {
  const origin = trimTrailingSlash(SITE_URL)

  const normalizedSearch = search && search !== '?' ? search : ''

  return `${origin}${normalizePath(path)}${normalizedSearch}`
}

type SeoOptions = {
  title: string
  description?: string
  image?: string
  keywords?: string
  noindex?: boolean
  ogType?: 'article' | 'website'
  articlePublishedTime?: string
  articleModifiedTime?: string
}

export const seo = ({
  title,
  description,
  keywords,
  image,
  noindex,
  ogType = 'website',
  articlePublishedTime,
  articleModifiedTime,
}: SeoOptions) => {
  const tags = [
    { title },
    { name: 'description', content: description },
    { name: 'keywords', content: keywords },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:creator', content: '@tan_stack' },
    { name: 'twitter:site', content: '@tan_stack' },
    { property: 'og:type', content: ogType },
    { property: 'og:site_name', content: 'TanStack' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    ...(ogType === 'article' && articlePublishedTime
      ? [
          {
            property: 'article:published_time',
            content: articlePublishedTime,
          },
        ]
      : []),
    ...(ogType === 'article' && articleModifiedTime
      ? [
          {
            property: 'article:modified_time',
            content: articleModifiedTime,
          },
        ]
      : []),
    ...(image
      ? [
          { name: 'twitter:image', content: image },
          { name: 'twitter:image:alt', content: title },
          { name: 'twitter:card', content: 'summary_large_image' },
          { property: 'og:image', content: image },
          { property: 'og:image:alt', content: title },
        ]
      : []),
    ...(noindex ? [{ name: 'robots', content: 'noindex, nofollow' }] : []),
  ]

  return tags
}
