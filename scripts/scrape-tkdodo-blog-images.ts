/**
 * Scrapes the current TkDodo RSS posts that tanstack.com includes as external
 * blog cards, downloads their article hero images, and writes the generated
 * slug-to-image map used by the external blog parser.
 *
 * Run with: pnpm exec tsx scripts/scrape-tkdodo-blog-images.ts
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { load, type CheerioAPI } from 'cheerio'

type FeedItem = {
  title: string
  link: string
  categories: Array<string>
}

type ImageEntry = {
  imageUrl: string
  localPath: string
  slug: string
  title: string
}

const FEED_URL = 'https://tkdodo.eu/blog/rss.xml'
const SOURCE_SLUG_PREFIX = 'tkdodo'
const ASSET_DIR = resolve(process.cwd(), 'public/blog-assets/tkdodosblog')
const PUBLIC_ASSET_PREFIX = '/blog-assets/tkdodosblog'
const GENERATED_MAP_PATH = resolve(
  process.cwd(),
  'src/utils/external-blog-post-images.generated.ts',
)

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

function shouldIncludePost(item: FeedItem) {
  const signal = normalizeSearchValue(
    `${item.title} ${item.link} ${item.categories.join(' ')}`,
  )

  return (
    includesPhrase(signal, 'react query') ||
    includesPhrase(signal, 'tanstack query') ||
    includesPhrase(signal, 'tan stack query') ||
    hasWord(signal, 'query') ||
    hasWord(signal, 'queries') ||
    includesPhrase(signal, 'tanstack router') ||
    includesPhrase(signal, 'tan stack router') ||
    hasWord(signal, 'router')
  )
}

function slugify(value: string) {
  return normalizeSearchValue(value).replace(/\s+/g, '-')
}

function getExternalPostSlug(item: FeedItem) {
  try {
    const pathnameSlug = new URL(item.link).pathname
      .split('/')
      .filter(Boolean)
      .pop()

    if (pathnameSlug) {
      return `${SOURCE_SLUG_PREFIX}-${pathnameSlug}`
    }
  } catch {
    // Fall through to the title slug.
  }

  return `${SOURCE_SLUG_PREFIX}-${slugify(item.title)}`
}

async function fetchText(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return response.text()
}

async function fetchImage(url: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? undefined,
  }
}

function toAbsoluteUrl(url: string, baseUrl: string) {
  return new URL(url, baseUrl).toString()
}

function decodeNetlifyImageSource(src: string, baseUrl: string) {
  try {
    const url = new URL(src, baseUrl)
    const originalUrl = url.searchParams.get('url')

    return originalUrl ? toAbsoluteUrl(originalUrl, baseUrl) : undefined
  } catch {
    return undefined
  }
}

function getImageSource(
  $: CheerioAPI,
  image: Parameters<CheerioAPI>[0],
  baseUrl: string,
) {
  const $image = $(image)
  const source =
    $image.attr('url') ??
    decodeNetlifyImageSource($image.attr('src') ?? '', baseUrl) ??
    $image.attr('src')

  return source ? toAbsoluteUrl(source, baseUrl) : undefined
}

function getOgImage($: CheerioAPI, baseUrl: string) {
  const image =
    $('meta[property="og:image"]').attr('content') ??
    $('meta[name="twitter:image"]').attr('content')

  return image ? toAbsoluteUrl(image, baseUrl) : undefined
}

function getArticleHeroImageUrl(html: string, articleUrl: string) {
  const $ = load(html)

  for (const image of $('article img').toArray()) {
    const imageUrl = getImageSource($, image, articleUrl)

    if (!imageUrl) {
      continue
    }

    const isBlogImage =
      imageUrl.includes('/blog/_astro/') ||
      imageUrl.includes('/blog/og-images/')
    const isReferralImage =
      imageUrl.includes('/query-gg.') || imageUrl.includes('/bytes.')

    if (isBlogImage && !isReferralImage) {
      return imageUrl
    }
  }

  return getOgImage($, articleUrl)
}

function parseFeed(feed: string) {
  const $ = load(feed, { xmlMode: true })

  return $('item')
    .toArray()
    .map((item): FeedItem => {
      const $item = $(item)

      return {
        title: $item.children('title').first().text().trim(),
        link: $item.children('link').first().text().trim(),
        categories: $item
          .children('category')
          .toArray()
          .map((category) => $(category).text().trim())
          .filter(Boolean),
      }
    })
    .filter((item) => item.title && item.link && shouldIncludePost(item))
}

function getExtension(url: string, contentType: string | undefined) {
  const pathnameExtension = extname(new URL(url).pathname)

  if (pathnameExtension) {
    return pathnameExtension
  }

  switch (contentType?.split(';')[0]) {
    case 'image/jpeg':
      return '.jpg'
    case 'image/png':
      return '.png'
    case 'image/webp':
      return '.webp'
    default:
      return '.jpg'
  }
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9._-]+/gi, '-')
}

function quoteTs(value: string) {
  return JSON.stringify(value)
}

function renderGeneratedMap(entries: Array<ImageEntry>) {
  const sortedEntries = [...entries].sort((a, b) =>
    a.slug.localeCompare(b.slug),
  )
  const lines = [
    '// Generated by scripts/scrape-tkdodo-blog-images.ts. Do not edit manually.',
    'export const externalBlogPostHeaderImages = {',
    '  tkdodo: {',
    ...sortedEntries.map(
      (entry) => `    ${quoteTs(entry.slug)}: ${quoteTs(entry.localPath)},`,
    ),
    '  },',
    '} as const satisfies Record<string, Record<string, string>>',
    '',
  ]

  return lines.join('\n')
}

async function scrapePostImage(
  item: FeedItem,
): Promise<ImageEntry | undefined> {
  const slug = getExternalPostSlug(item)
  const html = await fetchText(item.link)
  const imageUrl = getArticleHeroImageUrl(html, item.link)

  if (!imageUrl) {
    console.warn(`[skip] ${slug}: no article image found`)
    return undefined
  }

  const image = await fetchImage(imageUrl)
  const fileSlug = slug.replace(`${SOURCE_SLUG_PREFIX}-`, '')
  const fileName = `${sanitizeFileName(fileSlug)}${getExtension(
    imageUrl,
    image.contentType,
  )}`
  const localPath = `${PUBLIC_ASSET_PREFIX}/${fileName}`

  await writeFile(resolve(ASSET_DIR, fileName), image.bytes)
  console.log(`[ok] ${slug} -> ${localPath}`)

  return {
    imageUrl,
    localPath,
    slug,
    title: item.title,
  }
}

async function main() {
  await mkdir(ASSET_DIR, { recursive: true })

  const items = parseFeed(await fetchText(FEED_URL))
  const entries: Array<ImageEntry> = []

  console.log(`Found ${items.length} matching TkDodo posts`)

  for (const item of items) {
    const entry = await scrapePostImage(item)

    if (entry) {
      entries.push(entry)
    }
  }

  await writeFile(GENERATED_MAP_PATH, renderGeneratedMap(entries))
  console.log(`Wrote ${entries.length} image mappings to ${GENERATED_MAP_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
