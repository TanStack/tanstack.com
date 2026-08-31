import type { BlockNode, MarkdownDocument } from '@tanstack/markdown'
import { isChartsCatalogCaseId } from './charts-catalog'

export const chartsCatalogEmbedPrefix = '/charts/catalog/embed/'

export type ChartsCatalogEmbed = {
  caseId: string
  origin: string
  source: ChartsCatalogEmbedSource
}

export type ChartsCatalogEmbedTheme = 'system' | 'light' | 'dark'
export type ChartsCatalogEmbedSource = 'hidden' | 'collapsed' | 'expanded'

export function parseChartsCatalogExampleAttributes(value: unknown) {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['id', 'height']) ||
    typeof value.id !== 'string' ||
    !isChartsCatalogCaseId(value.id)
  ) {
    return null
  }

  const height = parseStrictInteger(value.height, 480, 1_200)
  if (height === null) return null

  return { caseId: value.id, height }
}

export function isChartsCatalogEmbedPath(pathname: string) {
  if (
    !pathname.startsWith(chartsCatalogEmbedPrefix) ||
    !pathname.endsWith('/')
  ) {
    return false
  }
  return isChartsCatalogCaseId(
    pathname.slice(chartsCatalogEmbedPrefix.length, -1),
  )
}

export function parseChartsCatalogEmbed(
  source: string | undefined,
): ChartsCatalogEmbed | null {
  if (!source) return null

  let url: URL
  try {
    url = new URL(source)
  } catch {
    return null
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'tanstack.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.hash ||
    !isChartsCatalogEmbedPath(url.pathname)
  ) {
    return null
  }

  const allowedParameters = new Set(['height', 'revision', 'source', 'theme'])
  for (const key of url.searchParams.keys()) {
    if (!allowedParameters.has(key)) return null
  }

  const sourceMode = url.searchParams.get('source')
  if (sourceMode !== null && !isChartsCatalogEmbedSource(sourceMode)) {
    return null
  }

  const theme = url.searchParams.get('theme')
  if (theme !== null && !isChartsCatalogEmbedTheme(theme)) return null

  const height = url.searchParams.get('height')
  if (height !== null && !isBoundedInteger(height, 120, 1_200)) return null

  const revision = url.searchParams.get('revision')
  if (revision !== null && !isBoundedInteger(revision, 0, 10_000)) return null

  return {
    caseId: url.pathname.slice(chartsCatalogEmbedPrefix.length, -1),
    origin: url.origin,
    source: sourceMode ?? 'hidden',
  }
}

export function isChartsCatalogEmbedSource(
  value: unknown,
): value is ChartsCatalogEmbedSource {
  return value === 'hidden' || value === 'collapsed' || value === 'expanded'
}

export function isChartsCatalogEmbedTheme(
  value: unknown,
): value is ChartsCatalogEmbedTheme {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function withChartsCatalogEmbedSource(
  source: string,
  sourceMode: ChartsCatalogEmbedSource,
) {
  const url = new URL(source)
  if (!url.searchParams.has('source')) {
    url.searchParams.set('source', sourceMode)
  }
  return url.toString()
}

const chartIframePattern = /^\s*<iframe\s+([\s\S]*?)>\s*<\/iframe>\s*$/i
const chartIframeAttributePattern =
  /([a-zA-Z][a-zA-Z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
const chartIframeAttributes = new Set([
  'height',
  'loading',
  'src',
  'style',
  'title',
  'width',
])

export function mapChartsCatalogEmbeds(
  document: MarkdownDocument,
  sourceMode: ChartsCatalogEmbedSource,
): MarkdownDocument {
  return {
    ...document,
    children: document.children.map((block) => {
      if (block.type !== 'html') return block
      return createChartsCatalogEmbedBlock(block.value, sourceMode) ?? block
    }),
  }
}

function createChartsCatalogEmbedBlock(
  html: string,
  sourceMode: ChartsCatalogEmbedSource,
): BlockNode | undefined {
  const iframe = html.match(chartIframePattern)
  const attributeSource = iframe?.[1]
  if (!attributeSource) return undefined

  const attributes: Record<string, string> = {}
  for (const attribute of attributeSource.matchAll(
    chartIframeAttributePattern,
  )) {
    const name = attribute[1]?.toLowerCase()
    const value = attribute[2] ?? attribute[3]
    if (!name || value === undefined || !chartIframeAttributes.has(name)) {
      return undefined
    }
    if (name === 'style') continue
    attributes[name] = value
  }

  if (
    attributeSource.replace(chartIframeAttributePattern, '').trim() ||
    !attributes.src
  ) {
    return undefined
  }

  const source = attributes.src.replaceAll('&amp;', '&')
  if (!parseChartsCatalogEmbed(source)) return undefined

  return {
    type: 'component',
    name: 'chart-catalog-embed',
    tagName: 'chart-catalog-embed',
    attributes: {},
    properties: {
      ...attributes,
      src: withChartsCatalogEmbedSource(source, sourceMode),
    },
    children: [],
  }
}

function isBoundedInteger(value: string, minimum: number, maximum: number) {
  if (!/^\d+$/.test(value)) return false
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}

function parseStrictInteger(value: unknown, minimum: number, maximum: number) {
  if (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  ) {
    return value
  }
  if (typeof value !== 'string' || !isBoundedInteger(value, minimum, maximum)) {
    return null
  }
  return Number(value)
}
