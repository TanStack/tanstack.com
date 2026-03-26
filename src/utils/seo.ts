import { env } from '~/utils/env'
import { findLibrary } from '~/libraries'

const DEFAULT_SITE_URL = 'https://tanstack.com'
const NON_INDEXABLE_PATH_PREFIXES = ['/account', '/admin', '/login'] as const

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

  const pathSegments = normalizedPath.split('/').filter(Boolean)

  if (pathSegments.length >= 2) {
    const [libraryId, version, ...rest] = pathSegments
    const library = findLibrary(libraryId)

    if (library && version !== 'latest') {
      return normalizePath(`/${library.id}/latest/${rest.join('/')}`)
    }
  }

  return normalizedPath
}

export function shouldIndexPath(path: string) {
  return getCanonicalPath(path) !== null
}

export function canonicalUrl(path: string) {
  const origin = trimTrailingSlash(
    env.URL ||
      (import.meta.env.SSR ? env.SITE_URL : undefined) ||
      DEFAULT_SITE_URL,
  )

  return `${origin}${normalizePath(path)}`
}

export function canonicalLink(path: string) {
  return [{ rel: 'canonical', href: canonicalUrl(path) }]
}

type SeoOptions = {
  title: string
  description?: string
  image?: string
  keywords?: string
  noindex?: boolean
}

type HeadWithCanonical = {
  meta?: Array<Record<string, string | undefined>>
  links?: Array<{ rel: string; href: string }>
}

export function withCanonical(path: string, head: HeadWithCanonical = {}) {
  return {
    ...head,
    links: [...canonicalLink(path), ...(head.links ?? [])],
  }
}

export function seoWithCanonical(path: string, options: SeoOptions) {
  return withCanonical(path, { meta: seo(options) })
}

export const seo = ({
  title,
  description,
  keywords,
  image,
  noindex,
}: SeoOptions) => {
  const tags = [
    { title },
    { name: 'description', content: description },
    { name: 'keywords', content: keywords },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:creator', content: '@tannerlinsley' },
    { name: 'twitter:site', content: '@tannerlinsley' },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    ...(image
      ? [
          { name: 'twitter:image', content: image },
          { name: 'twitter:card', content: 'summary_large_image' },
          { property: 'og:image', content: image },
        ]
      : []),
    ...(noindex ? [{ name: 'robots', content: 'noindex, nofollow' }] : []),
  ]

  return tags
}
