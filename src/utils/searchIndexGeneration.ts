import type { LibraryId } from '~/libraries/types'
import type {
  SearchHierarchy,
  SearchRecord,
  SearchRouteStyle,
} from './searchRecords'
import {
  extractMarkdownSearchSections,
  type MarkdownSearchSection,
} from './markdown/searchExtraction'
import type { PackageManager } from './markdown/installCommand'

const DEFAULT_SITE_URL = 'https://tanstack.com'
const INTENT_REGISTRY_PATH = '/intent/registry'

type SearchIndexLibrary = {
  id: LibraryId
  name: string
}

export type SearchIndexMarkdownInput = {
  library: SearchIndexLibrary
  version: string
  docsPath: string
  title: string
  content: string
  siteUrl?: string
  packageManager?: PackageManager
}

function normalizeUrlPath(path: string) {
  const normalizedPath = `/${path.split('/').filter(Boolean).join('/')}`

  if (normalizedPath === '/') {
    return '/'
  }

  return normalizedPath.replace(/\/+$/g, '')
}

function getUrlPathname(url: string) {
  try {
    return new URL(url, DEFAULT_SITE_URL).pathname
  } catch {
    return normalizeUrlPath(url.split('#')[0]?.split('?')[0] ?? url)
  }
}

export function isExcludedFromSearchIndex(url: string) {
  const pathname = normalizeUrlPath(getUrlPathname(url))

  return (
    pathname === INTENT_REGISTRY_PATH ||
    pathname.startsWith(`${INTENT_REGISTRY_PATH}/`)
  )
}

function normalizeSiteUrl(siteUrl: string | undefined) {
  return (siteUrl || DEFAULT_SITE_URL).replace(/\/+$/g, '')
}

function normalizeDocsPath(docsPath: string) {
  return docsPath
    .replace(/\.md$/i, '')
    .split('/')
    .filter(Boolean)
    .join('/')
    .replace(/\/index$/i, '')
}

function getRouteStyle(docsPath: string): SearchRouteStyle {
  return docsPath.startsWith('framework/') ? 'framework-path' : 'canonical'
}

function getFrameworkFromDocsPath(docsPath: string) {
  const segments = docsPath.split('/').filter(Boolean)

  if (segments[0] !== 'framework') {
    return null
  }

  return segments[1] ?? null
}

function buildUrl(input: {
  siteUrl?: string
  libraryId: LibraryId
  version: string
  docsPath: string
}) {
  const basePath = [
    input.libraryId,
    input.version,
    'docs',
    ...input.docsPath.split('/').filter(Boolean),
  ].join('/')

  return `${normalizeSiteUrl(input.siteUrl)}/${basePath}`.replace(/\/+$/g, '')
}

function appendAnchor(url: string, anchor: string | undefined) {
  if (!anchor) {
    return url
  }

  return `${url}#${anchor}`
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function buildHierarchy(
  libraryName: string,
  title: string,
  section: MarkdownSearchSection,
): SearchHierarchy {
  const normalizedTitle = normalizeText(title)
  const normalizedHeading = section.heading
    ? normalizeText(section.heading)
    : undefined
  const hierarchy: SearchHierarchy = {
    lvl0: libraryName,
    lvl1: normalizedTitle || libraryName,
  }

  if (normalizedHeading && normalizedHeading !== normalizedTitle) {
    hierarchy.lvl2 = normalizedHeading
  }

  return hierarchy
}

function getRecordFramework(
  routeStyle: SearchRouteStyle,
  pathFramework: string | null,
  sectionFramework: string,
) {
  if (routeStyle === 'canonical') {
    return sectionFramework
  }

  if (!pathFramework) {
    return null
  }

  if (sectionFramework === 'all') {
    return pathFramework
  }

  if (sectionFramework === pathFramework) {
    return sectionFramework
  }

  return null
}

function buildObjectId(input: {
  libraryId: LibraryId
  version: string
  docsPath: string
  framework: string
  anchor?: string
  index: number
}) {
  return [
    input.libraryId,
    input.version,
    input.framework,
    input.docsPath || 'index',
    input.anchor || 'root',
    String(input.index),
  ].join(':')
}

export async function buildSearchRecordsForMarkdown(
  input: SearchIndexMarkdownInput,
): Promise<Array<SearchRecord>> {
  const docsPath = normalizeDocsPath(input.docsPath)
  const url = buildUrl({
    siteUrl: input.siteUrl,
    libraryId: input.library.id,
    version: input.version,
    docsPath,
  })

  if (isExcludedFromSearchIndex(url)) {
    return []
  }

  const routeStyle = getRouteStyle(docsPath)
  const pathFramework = getFrameworkFromDocsPath(docsPath)
  const extraction = await extractMarkdownSearchSections(
    `# ${input.title}\n${input.content}`,
    { packageManager: input.packageManager },
  )
  const records: Array<SearchRecord> = []

  for (const section of extraction.sections) {
    const framework = getRecordFramework(
      routeStyle,
      pathFramework,
      section.framework,
    )

    if (!framework) {
      continue
    }

    const urlWithAnchor = appendAnchor(url, section.anchor)
    if (isExcludedFromSearchIndex(urlWithAnchor)) {
      continue
    }

    records.push({
      objectID: buildObjectId({
        libraryId: input.library.id,
        version: input.version,
        docsPath,
        framework,
        anchor: section.anchor,
        index: records.length,
      }),
      url,
      anchor: section.anchor,
      urlWithAnchor,
      library: input.library.id,
      framework,
      version: input.version,
      routeStyle,
      hierarchy: buildHierarchy(input.library.name, input.title, section),
      content: section.content,
    })
  }

  return records
}
