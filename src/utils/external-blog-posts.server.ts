import type { LibraryId } from '~/libraries'
import { normalizeBlogAuthors, type BlogCardPost } from '~/utils/blog'
import { fetchCached } from '~/utils/cache.server'

const DEFAULT_STANDARD_SITE_TIMEOUT_MS = 5000 // 5 seconds
const DEFAULT_STANDARD_SITE_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const STANDARD_SITE_DOCUMENT_COLLECTION = 'site.standard.document'
const STANDARD_SITE_PAGE_LIMIT = 100

type ExternalLibraryId = Extract<LibraryId, 'query' | 'router'>

type ExternalBlogItem = {
  title: string
  link: string
  excerpt: string
  published: string | undefined
  categories: Array<string>
}

type StandardSiteBlob = {
  ref?: {
    $link?: string
  }
  mimeType?: string
  size?: number
}

type StandardSiteDocument = {
  $type?: string
  canonicalUrl?: string
  coverImage?: StandardSiteBlob
  description?: string
  path?: string
  publishedAt?: string
  title?: string
}

type StandardSiteRecord = {
  uri: string
  value: StandardSiteDocument
}

type StandardSiteListRecordsResponse = {
  cursor?: string
  records?: Array<StandardSiteRecord>
}

type StandardSiteExternalBlogSource = {
  type: 'standard-site'
  id: string
  name: string
  siteUrl: string
  pdsUrl: string
  repo: string
  collection?: string
  slugPrefix: string
  authors: Array<string>
  externalUrlSearchParams?: Record<string, string>
  cacheTtlMs?: number
  timeoutMs?: number
  maxPages?: number
  inferLibraries?: (item: ExternalBlogItem) => Array<LibraryId>
}

type ExternalBlogSource = StandardSiteExternalBlogSource

const externalBlogSources = [
  {
    type: 'standard-site',
    id: 'tkdodo',
    name: "TkDodo's Blog",
    siteUrl: 'https://tkdodo.eu',
    pdsUrl: 'https://eurosky.social',
    repo: 'did:plc:3nqrhu5mthmias3zc4a2ovzj',
    slugPrefix: 'tkdodo',
    authors: ['Dominik Dorfmeister'],
    externalUrlSearchParams: {
      utm_source: 'tanstack.com',
      utm_medium: 'referral',
      utm_campaign: 'tanstack_blog',
    },
    inferLibraries: inferTanStackQueryAndRouterLibraries,
  },
] satisfies Array<ExternalBlogSource>

function normalizeSearchValue(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function includesPhrase(value: string, phrase: string) {
  return value.includes(normalizeSearchValue(phrase))
}

function hasWord(value: string, word: string) {
  return new RegExp(`\\b${word}\\b`).test(value)
}

function inferTanStackQueryAndRouterLibraries(
  item: ExternalBlogItem,
): Array<LibraryId> {
  const signal = normalizeSearchValue(
    `${item.title} ${item.link} ${item.categories.join(' ')}`,
  )
  const libraries: Array<LibraryId> = []

  if (
    includesPhrase(signal, 'react query') ||
    includesPhrase(signal, 'tanstack query') ||
    includesPhrase(signal, 'tan stack query') ||
    hasWord(signal, 'query') ||
    hasWord(signal, 'queries')
  ) {
    libraries.push('query')
  }

  if (
    includesPhrase(signal, 'tanstack router') ||
    includesPhrase(signal, 'tan stack router')
  ) {
    libraries.push('router')
  }

  return libraries
}

export function inferExternalPostLibraries(
  title: string,
  link: string,
): Array<ExternalLibraryId> {
  return inferTanStackQueryAndRouterLibraries({
    title,
    link,
    excerpt: '',
    published: undefined,
    categories: [],
  }) as Array<ExternalLibraryId>
}

function parseStandardSitePublishedDate(publishedAt: string | undefined) {
  if (!publishedAt) {
    return undefined
  }

  const date = new Date(publishedAt)

  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date.toISOString().slice(0, 10)
}

function slugify(value: string) {
  return normalizeSearchValue(value).replace(/\s+/g, '-')
}

function getExternalPostSlug(
  source: ExternalBlogSource,
  item: ExternalBlogItem,
) {
  try {
    const pathnameSlug = new URL(item.link).pathname
      .split('/')
      .filter(Boolean)
      .pop()

    if (pathnameSlug) {
      return `${source.slugPrefix}-${pathnameSlug}`
    }
  } catch {
    // Fall through to the title slug.
  }

  return `${source.slugPrefix}-${slugify(item.title)}`
}

function addSearchParams(
  url: string,
  searchParams: Record<string, string> | undefined,
) {
  if (!searchParams) {
    return url
  }

  try {
    const nextUrl = new URL(url)

    for (const [key, value] of Object.entries(searchParams)) {
      nextUrl.searchParams.set(key, value)
    }

    return nextUrl.toString()
  } catch {
    return url
  }
}

function buildStandardSiteCanonicalUrl(
  source: StandardSiteExternalBlogSource,
  document: StandardSiteDocument,
) {
  if (document.canonicalUrl) {
    return document.canonicalUrl
  }

  if (!document.path) {
    return undefined
  }

  return new URL(document.path, source.siteUrl).toString()
}

function buildStandardSiteBlobUrl(
  source: StandardSiteExternalBlogSource,
  blob: StandardSiteBlob | undefined,
) {
  const cid = blob?.ref?.$link

  if (!cid) {
    return undefined
  }

  const url = new URL('/xrpc/com.atproto.sync.getBlob', source.pdsUrl)
  url.searchParams.set('did', source.repo)
  url.searchParams.set('cid', cid)

  return url.toString()
}

async function fetchStandardSitePage(
  source: StandardSiteExternalBlogSource,
  cursor?: string,
): Promise<StandardSiteListRecordsResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    source.timeoutMs ?? DEFAULT_STANDARD_SITE_TIMEOUT_MS,
  )

  try {
    const url = new URL('/xrpc/com.atproto.repo.listRecords', source.pdsUrl)
    url.searchParams.set('repo', source.repo)
    url.searchParams.set(
      'collection',
      source.collection ?? STANDARD_SITE_DOCUMENT_COLLECTION,
    )
    url.searchParams.set('limit', String(STANDARD_SITE_PAGE_LIMIT))

    if (cursor) {
      url.searchParams.set('cursor', cursor)
    }

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'max-age=3600',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url.toString()}: ${response.status} ${
          response.statusText
        }`,
      )
    }

    return response.json() as Promise<StandardSiteListRecordsResponse>
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchStandardSiteRecords(
  source: StandardSiteExternalBlogSource,
) {
  const records: Array<StandardSiteRecord> = []
  const maxPages = source.maxPages ?? 10
  let cursor: string | undefined

  for (let page = 0; page < maxPages; page++) {
    const response = await fetchStandardSitePage(source, cursor)
    const pageRecords = Array.isArray(response.records) ? response.records : []

    records.push(...pageRecords)

    if (!response.cursor || pageRecords.length < STANDARD_SITE_PAGE_LIMIT) {
      break
    }

    cursor = response.cursor
  }

  return records
}

function standardSiteRecordToBlogCardPost(
  source: StandardSiteExternalBlogSource,
  record: StandardSiteRecord,
): BlogCardPost | undefined {
  const document = record.value
  const title = document.title?.trim()
  const link = buildStandardSiteCanonicalUrl(source, document)
  const published = parseStandardSitePublishedDate(document.publishedAt)

  if (!title || !link || !published) {
    return undefined
  }

  const item: ExternalBlogItem = {
    title,
    link,
    excerpt: document.description?.trim() ?? '',
    published,
    categories: [],
  }
  const libraries =
    source.inferLibraries?.(item) ?? inferTanStackQueryAndRouterLibraries(item)

  if (!libraries.length) {
    return undefined
  }

  return {
    slug: getExternalPostSlug(source, item),
    title,
    published,
    excerpt: item.excerpt,
    headerImage: buildStandardSiteBlobUrl(source, document.coverImage),
    authors: normalizeBlogAuthors(source.authors),
    library: libraries.join(','),
    externalUrl: addSearchParams(link, source.externalUrlSearchParams),
    source: source.name,
  }
}

async function fetchStandardSiteBlogPosts(
  source: StandardSiteExternalBlogSource,
) {
  const records = await fetchStandardSiteRecords(source)

  return records.flatMap((record) => {
    const post = standardSiteRecordToBlogCardPost(source, record)

    return post ? [post] : []
  })
}

async function fetchExternalBlogPostsForSource(source: ExternalBlogSource) {
  return fetchCached({
    key: `external-blog-posts:${source.id}`,
    ttl: source.cacheTtlMs ?? DEFAULT_STANDARD_SITE_CACHE_TTL_MS,
    fn: async () => fetchStandardSiteBlogPosts(source),
  }).catch((error) => {
    console.warn(
      `Unable to load external blog posts from ${source.name}`,
      error,
    )
    return []
  })
}

export async function getExternalBlogPosts() {
  const postsBySource = await Promise.all(
    externalBlogSources.map((source) =>
      fetchExternalBlogPostsForSource(source),
    ),
  )

  return postsBySource.flat()
}
