import { SITE_URL } from '~/utils/site'

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
    { name: 'twitter:creator', content: '@tan_stack' },
    { name: 'twitter:site', content: '@tan_stack' },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'TanStack' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
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
