import type { NotebookAiExecution } from './notebook-ai'
import { notebookImports } from './notebook-environment'

const npmPackageNamePattern =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/
const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const maxManifestBytes = 256 * 1024
const maxMetadataBytes = 2 * 1024 * 1024
const maxResourceBytes = 256 * 1024
const maxReadCharacters = 50_000
const maxSearchResults = 80
const maxInspectionBytes = 16 * 1024 * 1024
const maxInspectionResources = 32
const downloadLimitMessage =
  'Notebook AI package download budget reached. Continue with the package evidence already gathered.'
const resourceLimitMessage =
  'Notebook AI package resource budget reached. Continue with the package evidence already gathered.'
export type NotebookAiResolvedModule = {
  specifier: string
  packageName: string
  packageVersion: string
  exportKey: string
}

export type NotebookAiPackageFetchOptions = {
  fetchState: NotebookAiPackageFetchState
  fetcher?: typeof fetch
  signal?: AbortSignal
  timeoutMs?: number
}

export type NotebookAiPackageFetchState = {
  load: (
    resource: string,
    loader: (recordBytes: (byteLength: number) => void) => Promise<string>,
  ) => Promise<string>
}

export function createNotebookAiPackageFetchState(
  options: {
    maxBytes?: number
    maxResources?: number
  } = {},
): NotebookAiPackageFetchState {
  const byteLimit = options.maxBytes ?? maxInspectionBytes
  const resourceLimit = options.maxResources ?? maxInspectionResources
  const resources = new Map<string, Promise<string>>()
  const attemptedResources = new Set<string>()
  let downloadedBytes = 0

  return {
    load(resource, loader) {
      const cached = resources.get(resource)
      if (cached) return cached
      if (!attemptedResources.has(resource)) {
        if (attemptedResources.size >= resourceLimit) {
          return Promise.reject(new Error(resourceLimitMessage))
        }
        attemptedResources.add(resource)
      }
      if (downloadedBytes >= byteLimit) {
        return Promise.reject(new Error(downloadLimitMessage))
      }

      const request = loader((byteLength) => {
        downloadedBytes += byteLength
        if (downloadedBytes > byteLimit) {
          throw new Error(downloadLimitMessage)
        }
      }).catch((error: unknown) => {
        if (isRetryablePackageFetchError(error)) resources.delete(resource)
        throw error
      })
      resources.set(resource, request)
      return request
    },
  }
}

function isRetryablePackageFetchError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof DOMException && error.name === 'AbortError')
  )
}

type PackageResource = {
  path: string
  size: number
  type: string
}

export function resolveNotebookAiModule(
  execution: NotebookAiExecution,
  specifier: string,
): NotebookAiResolvedModule {
  const parsed = parseModuleSpecifier(specifier)
  const override = resolveImportOverride(execution, specifier)
  const overrideVersion = override
    ? parseExactEsmShVersion(override, parsed.packageName)
    : undefined
  if (override && !overrideVersion) {
    throw new Error(
      `Module ${specifier} is overridden by a non-npm URL and cannot be inspected as an npm package.`,
    )
  }

  const workspacePackageVersion = readWorkspacePackageVersion(
    execution,
    parsed.packageName,
  )
  const packageVersion =
    overrideVersion ??
    workspacePackageVersion ??
    readBuiltInPackageVersion(parsed.packageName)
  if (!packageVersion) {
    throw new Error(
      `Package ${parsed.packageName} is not an exact installed or built-in notebook dependency.`,
    )
  }

  return {
    specifier,
    packageName: parsed.packageName,
    packageVersion,
    exportKey: parsed.subpath ? `./${parsed.subpath}` : '.',
  }
}

export async function inspectNotebookAiModule(
  execution: NotebookAiExecution,
  specifier: string,
  options: NotebookAiPackageFetchOptions,
) {
  const resolved = resolveNotebookAiModule(execution, specifier)
  const manifestSource = await fetchPackageText(
    resolved,
    '/package.json',
    maxManifestBytes,
    options,
  )
  const manifest = parseJsonRecord(manifestSource, 'package manifest')
  const typesPath = resolvePackageExportPath(
    manifest,
    resolved.exportKey,
    'types',
  )
  const sourcePath = resolvePackageExportPath(
    manifest,
    resolved.exportKey,
    'import',
  )
  if (!typesPath && !sourcePath) {
    throw new Error(
      `Package ${resolved.packageName}@${resolved.packageVersion} does not expose ${resolved.exportKey}.`,
    )
  }

  const [types, source] = await Promise.all([
    typesPath
      ? fetchPackageText(resolved, typesPath, maxResourceBytes, options)
      : Promise.resolve(null),
    sourcePath
      ? fetchPackageText(resolved, sourcePath, maxResourceBytes, options)
      : Promise.resolve(null),
  ])
  const declarations = types ? chunkText(types, 0) : null
  const runtimeSource = source ? chunkText(source, 0) : null

  return {
    ...resolved,
    typesPath,
    sourcePath,
    detectedRuntimeExports: collectNamedExports(source ?? '', false),
    detectedDeclarationExports: collectNamedExports(types ?? '', true),
    declarations: declarations?.content ?? null,
    declarationsTruncated:
      declarations !== null && declarations.nextOffset !== null,
    source: runtimeSource?.content ?? null,
    sourceTruncated:
      runtimeSource !== null && runtimeSource.nextOffset !== null,
  }
}

export async function searchNotebookAiPackageResources(
  execution: NotebookAiExecution,
  specifier: string,
  query: string,
  options: NotebookAiPackageFetchOptions,
) {
  const resolved = resolveNotebookAiModule(execution, specifier)
  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery.length > 120) {
    throw new Error('Package resource search is limited to 120 characters.')
  }
  const metadataSource = await fetchPackageText(
    resolved,
    '/?meta',
    maxMetadataBytes,
    options,
  )
  const metadata = parseJsonRecord(metadataSource, 'package metadata')
  if (!Array.isArray(metadata.files)) {
    throw new Error('Invalid package metadata response.')
  }
  const terms = normalizedQuery.split(/\s+/).filter(Boolean)
  const resources = metadata.files
    .map(parsePackageResource)
    .filter((resource): resource is PackageResource => resource !== null)
    .filter((resource) =>
      isAllowedResourcePath(resolved.packageName, resource.path),
    )
    .filter((resource) => {
      const searchable = resource.path.toLowerCase()
      return terms.every((term) => searchable.includes(term))
    })
    .sort(comparePackageResources)
    .slice(0, maxSearchResults)

  return {
    ...resolved,
    query: normalizedQuery,
    resources,
    truncated: resources.length === maxSearchResults,
  }
}

export async function readNotebookAiPackageResource(
  execution: NotebookAiExecution,
  specifier: string,
  path: string,
  offset: number,
  options: NotebookAiPackageFetchOptions,
) {
  const resolved = resolveNotebookAiModule(execution, specifier)
  const resourcePath = normalizeResourcePath(path)
  if (!isAllowedResourcePath(resolved.packageName, resourcePath)) {
    throw new Error(`Package resource is not readable: ${resourcePath}`)
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('Package resource offset must be a non-negative integer.')
  }
  const content = await fetchPackageText(
    resolved,
    resourcePath,
    maxResourceBytes,
    options,
  )
  if (offset > content.length) {
    throw new Error(`Read offset exceeds package resource length: ${path}`)
  }
  const chunk = chunkText(content, offset)

  return {
    ...resolved,
    path: resourcePath,
    content: chunk.content,
    offset,
    totalCharacters: content.length,
    nextOffset: chunk.nextOffset,
  }
}

function parseModuleSpecifier(specifier: string) {
  if (
    !specifier ||
    specifier.length > 512 ||
    specifier.includes('\\') ||
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.includes('://')
  ) {
    throw new Error(`Invalid npm module specifier: ${specifier}`)
  }

  const segments = specifier.split('/')
  const packageName = specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0]!
  if (!npmPackageNamePattern.test(packageName)) {
    throw new Error(`Invalid npm module specifier: ${specifier}`)
  }
  const subpath = segments.slice(packageName.startsWith('@') ? 2 : 1).join('/')
  if (subpath && !isSafeRelativePath(subpath)) {
    throw new Error(`Invalid npm module subpath: ${specifier}`)
  }
  return { packageName, subpath }
}

function resolveImportOverride(
  execution: NotebookAiExecution,
  specifier: string,
) {
  const imports = execution.workspace.imports
  if (!imports) return undefined

  let match: { key: string; value: string } | undefined
  for (const [key, value] of Object.entries(imports)) {
    const matches =
      key === specifier || (key.endsWith('/') && specifier.startsWith(key))
    if (!matches || (match && match.key.length >= key.length)) continue
    match = { key, value }
  }
  if (!match) return undefined
  return match.key.endsWith('/')
    ? `${match.value}${specifier.slice(match.key.length)}`
    : match.value
}

function readWorkspacePackageVersion(
  execution: NotebookAiExecution,
  packageName: string,
) {
  const source = execution.workspace.files['/package.json']
  if (!source) return undefined

  let manifest: Record<string, unknown>
  try {
    manifest = parseJsonRecord(source, 'notebook package manifest')
  } catch {
    return undefined
  }

  for (const field of ['dependencies', 'devDependencies'] as const) {
    const dependencies = readRecord(manifest[field])
    const version = dependencies?.[packageName]
    if (typeof version === 'string') {
      if (exactVersionPattern.test(version)) return version
      throw new Error(
        `Package ${packageName} must use an exact version before it can be inspected.`,
      )
    }
  }
  return undefined
}

function readBuiltInPackageVersion(packageName: string) {
  const entry = Object.entries(notebookImports).find(
    ([specifier]) => specifier === packageName,
  )
  if (!entry) return undefined
  return parseExactEsmShVersion(entry[1], packageName)
}

function parseExactEsmShVersion(value: string, packageName: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  if (url.origin !== 'https://esm.sh') return undefined
  const pathname = decodeURIComponent(url.pathname.slice(1))
  const prefix = `${packageName}@`
  if (!pathname.startsWith(prefix)) return undefined
  const version = pathname.slice(prefix.length).split('/')[0]
  return exactVersionPattern.test(version) ? version : undefined
}

function resolvePackageExportPath(
  manifest: Record<string, unknown>,
  exportKey: string,
  condition: 'types' | 'import',
) {
  const exports = manifest.exports
  if (exports !== undefined) {
    const target = selectExportTarget(exports, exportKey)
    const path = readConditionalExportPath(target, condition)
    if (path) return normalizePackageTarget(path)
  }

  if (exportKey !== '.') return null
  const fallback =
    condition === 'types'
      ? (readString(manifest.types) ?? readString(manifest.typings))
      : (readString(manifest.module) ?? readString(manifest.main))
  return fallback ? normalizePackageTarget(fallback) : null
}

function selectExportTarget(exports: unknown, exportKey: string): unknown {
  if (!isRecord(exports)) return exportKey === '.' ? exports : undefined
  if (exportKey in exports) return exports[exportKey]
  if (
    exportKey === '.' &&
    !Object.keys(exports).some((key) => key.startsWith('.'))
  ) {
    return exports
  }

  const patterns = Object.keys(exports)
    .filter((key) => key.includes('*'))
    .sort((left, right) => right.length - left.length)
  for (const pattern of patterns) {
    const [prefix, suffix] = pattern.split('*')
    if (
      prefix === undefined ||
      suffix === undefined ||
      !exportKey.startsWith(prefix) ||
      !exportKey.endsWith(suffix)
    ) {
      continue
    }
    const replacement = exportKey.slice(
      prefix.length,
      exportKey.length - suffix.length,
    )
    return replaceExportWildcard(exports[pattern], replacement)
  }
  return undefined
}

function replaceExportWildcard(value: unknown, replacement: string): unknown {
  if (typeof value === 'string') return value.replaceAll('*', replacement)
  if (Array.isArray(value)) {
    return value.map((item) => replaceExportWildcard(item, replacement))
  }
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      replaceExportWildcard(item, replacement),
    ]),
  )
}

function readConditionalExportPath(
  value: unknown,
  condition: 'types' | 'import',
): string | undefined {
  if (typeof value === 'string') {
    return condition === 'import' || /\.d\.(?:ts|mts|cts)$/i.test(value)
      ? value
      : undefined
  }
  if (Array.isArray(value)) {
    for (const candidate of value) {
      const path = readConditionalExportPath(candidate, condition)
      if (path) return path
    }
    return undefined
  }
  if (!isRecord(value)) return undefined

  if (condition === 'types') {
    const direct = readConditionalExportPath(value.types, condition)
    if (direct) return direct
    for (const key of ['browser', 'import', 'default']) {
      if (!isRecord(value[key]) && !Array.isArray(value[key])) continue
      const nested = readConditionalExportPath(value[key], condition)
      if (nested) return nested
    }
    return undefined
  }

  const preferred = ['browser', 'import', 'default']
  for (const key of preferred) {
    const path = readConditionalExportPath(value[key], condition)
    if (path) return path
  }
  return undefined
}

function normalizePackageTarget(path: string) {
  const normalized = path.startsWith('./') ? `/${path.slice(2)}` : path
  return normalizeResourcePath(normalized)
}

function normalizeResourcePath(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const relative = normalized.slice(1)
  if (!relative || relative.length > 512 || !isSafeRelativePath(relative)) {
    throw new Error(`Invalid package resource path: ${path}`)
  }
  return normalized
}

function isSafeRelativePath(path: string) {
  return (
    !path.includes('\\') &&
    !path.includes('%') &&
    !path.includes('?') &&
    !path.includes('#') &&
    path
      .split('/')
      .every((segment) => segment && segment !== '.' && segment !== '..')
  )
}

function isAllowedResourcePath(packageName: string, path: string) {
  if (path === '/package.json' || /^\/readme(?:\.[a-z0-9]+)?$/i.test(path)) {
    return true
  }
  if (path === '/llms.txt') return true
  if (/^\/docs\/.+\.(?:md|mdx|txt)$/i.test(path)) return true
  if (
    /^\/(?:dist|src)\/.+\.(?:d\.ts|d\.mts|d\.cts|ts|tsx|js|mjs|cjs)$/i.test(
      path,
    )
  ) {
    return true
  }
  return (
    packageName.startsWith('@tanstack/') &&
    /^\/skills\/.+\.(?:md|mdx|txt)$/i.test(path)
  )
}

async function fetchPackageText(
  resolved: NotebookAiResolvedModule,
  path: string,
  maxBytes: number,
  options: NotebookAiPackageFetchOptions,
) {
  const suffix = path === '/?meta' ? '/?meta' : path
  const packagePath = `/${resolved.packageName}@${resolved.packageVersion}`
  const url = new URL(`https://unpkg.com${packagePath}${suffix}`)
  if (
    url.origin !== 'https://unpkg.com' ||
    !url.pathname.startsWith(`${packagePath}/`)
  ) {
    throw new Error('Invalid package resource URL.')
  }

  return options.fetchState.load(url.href, async (recordBytes) => {
    const fetcher = options.fetcher ?? fetch
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? 10_000,
    )
    const abortFromSource = () => controller.abort(options.signal?.reason)
    if (options.signal) {
      if (options.signal.aborted) controller.abort(options.signal.reason)
      else
        options.signal.addEventListener('abort', abortFromSource, {
          once: true,
        })
    }

    try {
      const response = await fetcher(url, {
        headers: {
          Accept:
            'application/json, text/plain, text/markdown, text/typescript, text/javascript',
        },
        redirect: 'manual',
        signal: controller.signal,
      })
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined)
        throw new Error(
          `Package resource request failed (${response.status}): ${path}`,
        )
      }
      return readResponseText(response, maxBytes, recordBytes)
    } finally {
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', abortFromSource)
    }
  })
}

async function readResponseText(
  response: Response,
  maxBytes: number,
  recordBytes: (byteLength: number) => void,
) {
  const contentLength = response.headers.get('content-length')
  if (contentLength) {
    const parsed = Number(contentLength)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > maxBytes) {
      await response.body?.cancel().catch(() => undefined)
      throw new Error(`Package resource exceeds ${maxBytes} bytes.`)
    }
  }
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer())
    recordBytes(bytes.byteLength)
    if (bytes.byteLength > maxBytes) {
      throw new Error(`Package resource exceeds ${maxBytes} bytes.`)
    }
    return new TextDecoder().decode(bytes)
  }

  const reader = response.body.getReader()
  const chunks: Array<Uint8Array> = []
  let total = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      total += result.value.byteLength
      recordBytes(result.value.byteLength)
      if (total > maxBytes) {
        throw new Error(`Package resource exceeds ${maxBytes} bytes.`)
      }
      chunks.push(result.value)
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(bytes)
}

function parseJsonRecord(source: string, label: string) {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error(`Invalid ${label}.`)
  }
  if (!isRecord(value)) throw new Error(`Invalid ${label}.`)
  return value
}

function parsePackageResource(value: unknown): PackageResource | null {
  if (
    !isRecord(value) ||
    typeof value.path !== 'string' ||
    typeof value.size !== 'number' ||
    !Number.isFinite(value.size) ||
    value.size < 0 ||
    typeof value.type !== 'string'
  ) {
    return null
  }
  try {
    return {
      path: normalizeResourcePath(value.path),
      size: value.size,
      type: value.type.slice(0, 120),
    }
  } catch {
    return null
  }
}

function comparePackageResources(
  left: PackageResource,
  right: PackageResource,
) {
  const score = (resource: PackageResource) => {
    if (resource.path === '/llms.txt') return 0
    if (/\/skills\/.+\/SKILL\.md$/i.test(resource.path)) return 1
    if (/^\/docs\//i.test(resource.path)) return 2
    if (/\.d\.(?:ts|mts|cts)$/i.test(resource.path)) return 3
    if (/^\/readme/i.test(resource.path)) return 4
    return 5
  }
  return score(left) - score(right) || left.path.localeCompare(right.path)
}

function collectNamedExports(source: string, includeTypeOnly: boolean) {
  const names = new Set<string>()
  for (const match of source.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    if (match[1]) names.add(match[1])
  }
  if (includeTypeOnly) {
    for (const match of source.matchAll(
      /export\s+(?:declare\s+)?(?:interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/g,
    )) {
      if (match[1]) names.add(match[1])
    }
  }
  for (const match of source.matchAll(/export\s+(type\s+)?\{([^}]+)\}/g)) {
    if (match[1] && !includeTypeOnly) continue
    for (const item of match[2]?.split(',') ?? []) {
      const trimmed = item.trim()
      if (!includeTypeOnly && trimmed.startsWith('type ')) continue
      const name = trimmed
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/i)
        .at(-1)
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) names.add(name)
    }
  }
  return [...names].sort()
}

function chunkText(content: string, offset: number) {
  const end = Math.min(content.length, offset + maxReadCharacters)
  return {
    content: content.slice(offset, end),
    nextOffset: end < content.length ? end : null,
  }
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function readString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
