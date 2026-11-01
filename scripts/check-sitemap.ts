import { load } from 'cheerio'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'

export function getSitemapUrls(xml: string) {
  const $ = load(xml, { xmlMode: true })
  return $('urlset > url > loc')
    .toArray()
    .map((node) => $(node).text().trim())
}

export function checkSitemapPage(
  expectedUrl: string,
  response: { status: number; headers: Headers; body: string },
) {
  const failures: Array<string> = []
  const expected = new URL(expectedUrl)
  if (
    /\/(?:drafts|readme(?:\.[^/]+)?)(?:\/|$)|\.draft(?:\/|$)/i.test(
      expected.pathname,
    ) ||
    /^\/(?:account|admin|login|partners-embed|sponsors-embed)(?:\/|$)/.test(
      expected.pathname,
    )
  ) {
    failures.push('disallowed sitemap path')
  }
  if (response.status !== 200) failures.push(`HTTP ${response.status}`)
  const $ = load(response.body)
  const canonical = $('head link[rel]')
    .toArray()
    .filter((node) =>
      ($(node).attr('rel') ?? '')
        .toLowerCase()
        .split(/\s+/)
        .includes('canonical'),
    )
  if (canonical.length !== 1) {
    failures.push(`expected one canonical link, found ${canonical.length}`)
  } else {
    const href = $(canonical[0]).attr('href')
    try {
      if (!href || new URL(href, expected).href !== expected.href) {
        failures.push('canonical does not match sitemap URL')
      }
    } catch {
      failures.push('invalid canonical URL')
    }
  }
  const directives = [
    response.headers.get('x-robots-tag') ?? '',
    ...$('meta[name]')
      .toArray()
      .filter((node) =>
        ['robots', 'googlebot', 'bingbot'].includes(
          ($(node).attr('name') ?? '').toLowerCase(),
        ),
      )
      .map((node) => $(node).attr('content') ?? ''),
  ]
  if (directives.some((value) => /\b(?:noindex|none)\b/i.test(value))) {
    failures.push('page is noindex')
  }
  if (
    $('h1')
      .toArray()
      .some((node) =>
        /^(?:content temporarily unavailable|page not found|not found|something went wrong)$/i.test(
          $(node).text().trim(),
        ),
      )
  )
    failures.push('error or temporary-unavailable heading')
  return failures
}

async function main() {
  const { values } = parseArgs({
    options: {
      sitemap: { type: 'string' },
      'base-url': { type: 'string' },
      limit: { type: 'string' },
    },
  })
  if (!values.sitemap)
    throw new Error(
      'Pass --sitemap <URL>; optionally --base-url <preview origin> and --limit <count>.',
    )
  const sitemap = new URL(values.sitemap)
  const base = values['base-url'] ? new URL(values['base-url']) : undefined
  const limit = values.limit === undefined ? Infinity : Number(values.limit)
  if (
    values.limit !== undefined &&
    (!Number.isSafeInteger(limit) || limit < 1)
  ) {
    throw new Error('--limit must be a positive integer')
  }
  const response = await fetch(sitemap, {
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  })
  if (response.status !== 200)
    throw new Error(`Sitemap returned HTTP ${response.status}`)
  const urls = getSitemapUrls(await response.text())
  if (!urls.length) throw new Error('Sitemap contains no URL entries')
  const selected = urls.slice(0, limit)
  let failed = 0
  for (let offset = 0; offset < selected.length; offset += 4) {
    const results = await Promise.all(
      selected.slice(offset, offset + 4).map(async (url) => {
        try {
          const canonical = new URL(url)
          const target = base
            ? new URL(canonical.pathname + canonical.search, base.origin)
            : canonical
          const page = await fetch(target, {
            redirect: 'manual',
            signal: AbortSignal.timeout(20_000),
          })
          return {
            url,
            failures: checkSitemapPage(url, {
              status: page.status,
              headers: page.headers,
              body: await page.text(),
            }),
          }
        } catch (error) {
          return {
            url,
            failures: [error instanceof Error ? error.message : String(error)],
          }
        }
      }),
    )
    for (const result of results) {
      if (result.failures.length) {
        failed++
        console.error(`${result.url}: ${result.failures.join('; ')}`)
      }
    }
  }
  console.log(
    `Checked ${selected.length}/${urls.length} sitemap URLs: ${failed} failed.${selected.length < urls.length ? ' Partial check only.' : ''}`,
  )
  if (failed) process.exitCode = 1
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main()
}
