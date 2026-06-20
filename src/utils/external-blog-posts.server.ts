import { load } from 'cheerio'
import type { LibraryId } from '~/libraries'
import { normalizeBlogAuthors, type BlogCardPost } from '~/utils/blog'
import { fetchCached } from '~/utils/cache.server'
import { externalBlogPostHeaderImages } from '~/utils/external-blog-post-images.generated'

const DEFAULT_RSS_TIMEOUT_MS = 5000 // 5 seconds
const DEFAULT_RSS_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

type ExternalLibraryId = Extract<LibraryId, 'query' | 'router'>

type ExternalFeedItem = {
  title: string
  link: string
  excerpt: string
  published: string | undefined
  categories: Array<string>
}

type ExternalBlogSource = {
  id: string
  name: string
  feedUrl: string
  slugPrefix: string
  authors: Array<string>
  headerImages?: Record<string, string>
  defaultHeaderImage?: string
  externalUrlSearchParams?: Record<string, string>
  cacheTtlMs?: number
  timeoutMs?: number
  inferLibraries?: (item: ExternalFeedItem) => Array<LibraryId>
  parseFeed?: (source: ExternalBlogSource, feed: string) => Array<BlogCardPost>
}

const externalBlogSources = [
  {
    id: 'tkdodo',
    name: "TkDodo's Blog",
    feedUrl: 'https://tkdodo.eu/blog/rss.xml',
    slugPrefix: 'tkdodo',
    authors: ['Dominik Dorfmeister'],
    headerImages: externalBlogPostHeaderImages.tkdodo,
    defaultHeaderImage: '/blog-assets/tkdodosblog/tkdodosblog.webp',
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
  item: ExternalFeedItem,
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

function parseRssPublishedDate(pubDate: string) {
  const date = new Date(pubDate)

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
  item: ExternalFeedItem,
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

function parseRssFeed(
  source: ExternalBlogSource,
  feed: string,
): Array<BlogCardPost> {
  const $ = load(feed, { xmlMode: true })

  return $('item')
    .toArray()
    .flatMap((item) => {
      const $item = $(item)
      const feedItem: ExternalFeedItem = {
        title: $item.children('title').first().text().trim(),
        link: $item.children('link').first().text().trim(),
        excerpt: $item.children('description').first().text().trim(),
        published: parseRssPublishedDate(
          $item.children('pubDate').first().text().trim(),
        ),
        categories: $item
          .children('category')
          .toArray()
          .map((category) => $(category).text().trim())
          .filter(Boolean),
      }
      const libraries =
        source.inferLibraries?.(feedItem) ??
        inferTanStackQueryAndRouterLibraries(feedItem)

      if (
        !feedItem.title ||
        !feedItem.link ||
        !feedItem.published ||
        !libraries.length
      ) {
        return []
      }

      const slug = getExternalPostSlug(source, feedItem)

      return [
        {
          slug,
          title: feedItem.title,
          published: feedItem.published,
          excerpt: feedItem.excerpt,
          headerImage: source.headerImages?.[slug] ?? source.defaultHeaderImage,
          authors: normalizeBlogAuthors(source.authors),
          library: libraries.join(','),
          externalUrl: addSearchParams(
            feedItem.link,
            source.externalUrlSearchParams,
          ),
          source: source.name,
        },
      ]
    })
}

async function fetchExternalFeed(source: ExternalBlogSource) {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    source.timeoutMs ?? DEFAULT_RSS_TIMEOUT_MS,
  )

  try {
    const response = await fetch(source.feedUrl, {
      headers: {
        Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
        'Cache-Control': 'max-age=3600',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${source.feedUrl}: ${response.status} ${response.statusText}`,
      )
    }

    return response.text()
  } finally {
    clearTimeout(timeout)
  }
}

async function getExternalBlogPostsForSource(source: ExternalBlogSource) {
  return fetchCached({
    key: `external-blog-posts:${source.id}`,
    ttl: source.cacheTtlMs ?? DEFAULT_RSS_CACHE_TTL_MS,
    fn: async () => {
      const feed = await fetchExternalFeed(source)
      return (source.parseFeed ?? parseRssFeed)(source, feed)
    },
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
    externalBlogSources.map((source) => getExternalBlogPostsForSource(source)),
  )

  return postsBySource.flat()
}
