import { notebookImports } from './notebook-environment'
import type { ExampleWorkspace } from './example-workspace'

const esmOrigin = 'https://esm.sh'
const unpkgOrigin = 'https://unpkg.com'
const packageMetadataResponseLimit = 512 * 1024
const esmMetadataTimeout = 10_000
const externalSpecifierLimit = 100
const chartsDataPrefix = '@tanstack/charts-data/'
const chartsDataUrl = notebookImports[chartsDataPrefix]
const exactVersionPattern =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const requestedVersionPattern = /^[0-9A-Za-z*.+~^<>=| -]+$/
const packagePartPattern = /^[a-z0-9][a-z0-9._~-]*$/
const metadataCache = new Map<string, Promise<EsmMetadata>>()
const packageManifestCache = new Map<string, Promise<PackageManifestMetadata>>()

export type ExampleImportMetadataFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export type ResolveExampleWorkspaceImportsOptions = {
  fetch?: ExampleImportMetadataFetch
  signal?: AbortSignal
}

type NpmSpecifier = {
  packageName: string
  query: string
  specifier: string
  subpath: string
}

type PackageGroup = {
  packageName: string
  requestedVersion: string
  specifiers: Array<NpmSpecifier>
}

type ResolvedPackageGroup = PackageGroup & {
  exactVersion: string
  peerPackages: ReadonlySet<string>
  peerSpecifiers: ReadonlySet<string>
}

type EsmMetadata = {
  peerImports: Array<string>
  version: string
}

type PackageManifestMetadata = {
  peerPackages: Array<string>
}

export async function resolveExampleWorkspaceImports(
  workspace: ExampleWorkspace,
  files: Record<string, string>,
  externalSpecifiers: ReadonlySet<string> = new Set(),
  options: ResolveExampleWorkspaceImportsOptions = {},
) {
  options.signal?.throwIfAborted()

  if (externalSpecifiers.size > externalSpecifierLimit) {
    throw new Error(
      `Example imports exceed the ${externalSpecifierLimit} package limit`,
    )
  }

  const packageVersions = getWorkspacePackageVersions(files['/package.json'])
  const workspaceImports = workspace.imports ?? {}
  const groups = new Map<string, PackageGroup>()
  const availablePackages = new Set<string>()
  let usesChartsData = false

  for (const specifier of [...externalSpecifiers].sort()) {
    if (isDirectModuleSpecifier(specifier)) continue

    const parsedSpecifier = tryParseNpmSpecifier(specifier)

    if (isImportMapped(workspaceImports, specifier)) {
      if (parsedSpecifier) availablePackages.add(parsedSpecifier.packageName)
      continue
    }

    const npmSpecifier = parsedSpecifier ?? parseNpmSpecifier(specifier)
    if (hasWorkspacePackageImport(workspaceImports, npmSpecifier.packageName)) {
      throw new Error(
        `The explicit ${npmSpecifier.packageName} import does not cover ${npmSpecifier.specifier}. Add a ${npmSpecifier.packageName}/ import mapping or map that subpath explicitly.`,
      )
    }

    if (specifier.startsWith(chartsDataPrefix)) {
      usesChartsData = true
      availablePackages.add('@tanstack/charts-data')
      continue
    }

    availablePackages.add(npmSpecifier.packageName)
    const existingGroup = groups.get(npmSpecifier.packageName)

    if (existingGroup) {
      existingGroup.specifiers.push(npmSpecifier)
      continue
    }

    const requestedVersion =
      packageVersions.get(npmSpecifier.packageName) ?? 'latest'
    validateRequestedVersion(npmSpecifier.packageName, requestedVersion)
    groups.set(npmSpecifier.packageName, {
      packageName: npmSpecifier.packageName,
      requestedVersion,
      specifiers: [npmSpecifier],
    })
  }

  const resolvedGroups = await Promise.all(
    [...groups.values()].map((group) =>
      resolvePackageGroup(group, options.fetch, options.signal),
    ),
  )
  const resolvedPackageNames = new Set(
    resolvedGroups.map((group) => group.packageName),
  )

  while (true) {
    const declaredPeerPackages = new Set<string>()
    for (const group of resolvedGroups) {
      for (const peerPackage of group.peerPackages) {
        if (
          packageVersions.has(peerPackage) &&
          !resolvedPackageNames.has(peerPackage) &&
          !hasWorkspacePackageImport(workspaceImports, peerPackage)
        ) {
          declaredPeerPackages.add(peerPackage)
        }
      }
    }
    if (declaredPeerPackages.size === 0) break
    if (
      resolvedGroups.length + declaredPeerPackages.size >
      externalSpecifierLimit
    ) {
      throw new Error(
        `Example imports exceed the ${externalSpecifierLimit} package limit`,
      )
    }

    const peerGroups = [...declaredPeerPackages].map((packageName) => {
      const requestedVersion = packageVersions.get(packageName)
      if (!requestedVersion) {
        throw new Error(`Missing declared peer version for ${packageName}`)
      }
      validateRequestedVersion(packageName, requestedVersion)
      return {
        packageName,
        requestedVersion,
        specifiers: [parseNpmSpecifier(packageName)],
      }
    })
    const resolvedPeers = await Promise.all(
      peerGroups.map((group) =>
        resolvePackageGroup(group, options.fetch, options.signal),
      ),
    )
    for (const group of resolvedPeers) {
      resolvedGroups.push(group)
      resolvedPackageNames.add(group.packageName)
      availablePackages.add(group.packageName)
    }
  }

  options.signal?.throwIfAborted()
  const resolvedByPackage = new Map(
    resolvedGroups.map((group) => [group.packageName, group]),
  )
  const externalPackages = new Map<string, Array<string>>()

  for (const group of resolvedGroups) {
    externalPackages.set(
      group.packageName,
      [...group.peerPackages]
        .filter(
          (peerPackage) =>
            peerPackage !== group.packageName &&
            ((availablePackages.has(peerPackage) &&
              resolvedByPackage.has(peerPackage)) ||
              hasWorkspacePackageImport(workspaceImports, peerPackage)),
        )
        .sort(),
    )
  }

  const imports: Record<string, string> = usesChartsData
    ? { [chartsDataPrefix]: chartsDataUrl }
    : {}
  const requiredPeerRoots = new Set(
    [...externalPackages.values()].flatMap((packages) => packages),
  )

  for (const packageName of requiredPeerRoots) {
    if (hasWorkspacePackageImport(workspaceImports, packageName)) {
      if (
        workspaceImports[packageName] === undefined ||
        workspaceImports[`${packageName}/`] === undefined
      ) {
        throw new Error(
          `The explicit ${packageName} peer import must map both ${packageName} and ${packageName}/.`,
        )
      }
      continue
    }

    const group = resolvedByPackage.get(packageName)
    if (!group) continue
    imports[packageName] = createEsmModuleUrl(
      packageName,
      group.exactVersion,
      '',
      '',
      externalPackages.get(packageName) ?? [],
    )
    imports[`${packageName}/`] =
      `${esmOrigin}/${packageName}@${group.exactVersion}/`
  }

  const peerSpecifiers = new Set(
    resolvedGroups.flatMap((group) => [...group.peerSpecifiers]),
  )

  for (const specifier of peerSpecifiers) {
    if (isImportMapped(workspaceImports, specifier)) continue
    const parsedSpecifier = parseNpmSpecifier(specifier)
    if (!requiredPeerRoots.has(parsedSpecifier.packageName)) continue
    const group = resolvedByPackage.get(parsedSpecifier.packageName)
    if (!group) continue
    imports[specifier] = createEsmModuleUrl(
      group.packageName,
      group.exactVersion,
      parsedSpecifier.subpath,
      parsedSpecifier.query,
      externalPackages.get(group.packageName) ?? [],
    )
  }

  for (const group of resolvedGroups) {
    for (const specifier of group.specifiers) {
      imports[specifier.specifier] = createEsmModuleUrl(
        group.packageName,
        group.exactVersion,
        specifier.subpath,
        specifier.query,
        externalPackages.get(group.packageName) ?? [],
      )
    }
  }

  return { ...imports, ...workspaceImports }
}

export function getExampleWorkspaceImports(
  workspace: ExampleWorkspace,
  files: Record<string, string>,
  externalSpecifiers: ReadonlySet<string> = new Set(),
) {
  const imports: Record<string, string> = { ...notebookImports }
  const packageSource = files['/package.json']

  if (!packageSource) return { ...imports, ...workspace.imports }

  let packageValue: unknown
  try {
    packageValue = JSON.parse(packageSource)
  } catch {
    throw new Error('Invalid /package.json')
  }

  if (!isRecord(packageValue)) {
    return { ...imports, ...workspace.imports }
  }

  const dependencies = getPackageVersions(packageValue.dependencies)
  const devDependencies = getPackageVersions(packageValue.devDependencies)
  const packageVersions = new Map([...devDependencies, ...dependencies])
  const importedPackages = [...packageVersions].filter(([name]) =>
    isPackageImported(name, externalSpecifiers),
  )
  const hasReact = packageVersions.has('react')

  for (const [name, version] of importedPackages) {
    removePackageImports(imports, name)

    const packageUrl = `https://esm.sh/${name}@${version}`
    imports[name] = `${packageUrl}${getPackageExternalQuery(name, hasReact)}`
    imports[`${name}/`] = `${packageUrl}/`

    if (name === 'react') {
      imports['react/jsx-dev-runtime'] = `${packageUrl}/jsx-dev-runtime`
      imports['react/jsx-runtime'] = `${packageUrl}/jsx-runtime`
    }

    if (name === 'react-dom') {
      imports['react-dom/client'] = `${packageUrl}/client?external=react`
    }
  }

  for (const specifier of externalSpecifiers) {
    const dependency = importedPackages.find(([name]) =>
      specifier.startsWith(`${name}/`),
    )
    if (!dependency) continue

    const [name, version] = dependency
    const subpath = specifier.slice(name.length + 1)
    const url = `https://esm.sh/${name}@${version}/${subpath}`
    imports[specifier] = appendQuery(
      url,
      getPackageExternalQuery(name, hasReact),
    )
  }

  return { ...imports, ...workspace.imports }
}

async function resolvePackageGroup(
  group: PackageGroup,
  metadataFetch: ExampleImportMetadataFetch | undefined,
  signal: AbortSignal | undefined,
): Promise<ResolvedPackageGroup> {
  const representative = group.specifiers[0]
  if (!representative)
    throw new Error(`Missing import for ${group.packageName}`)

  const requestedUrl = createEsmMetadataUrl(
    group.packageName,
    group.requestedVersion,
    representative.subpath,
  )
  const requestedMetadata = await getEsmMetadata(
    requestedUrl,
    metadataFetch,
    signal,
  )
  const exactVersion = requestedMetadata.version
  const [packageManifest, ...additionalMetadata] = await Promise.all([
    getPackageManifest(group.packageName, exactVersion, metadataFetch, signal),
    ...group.specifiers.slice(1).map((specifier) => {
      const exactUrl = createEsmMetadataUrl(
        group.packageName,
        exactVersion,
        specifier.subpath,
      )
      return getEsmMetadata(exactUrl, metadataFetch, signal)
    }),
  ])
  const metadata = [requestedMetadata, ...additionalMetadata]
  const peerPackages = new Set(packageManifest.peerPackages)
  const peerSpecifiers = new Set<string>()

  for (const value of metadata) {
    if (value.version !== exactVersion) {
      throw new Error(
        `esm.sh returned conflicting versions for ${group.packageName}`,
      )
    }

    for (const peerImport of value.peerImports) {
      const peer = parsePeerImport(peerImport)
      if (!peer) {
        throw new Error(`Invalid peer import in esm.sh metadata: ${peerImport}`)
      }
      peerPackages.add(peer.packageName)
      peerSpecifiers.add(peer.specifier)
    }
  }

  return { ...group, exactVersion, peerPackages, peerSpecifiers }
}

function getWorkspacePackageVersions(packageSource: string | undefined) {
  if (!packageSource) return new Map<string, string>()

  let packageValue: unknown
  try {
    packageValue = JSON.parse(packageSource)
  } catch {
    throw new Error('Invalid /package.json')
  }

  if (!isRecord(packageValue)) return new Map<string, string>()
  return new Map([
    ...getPackageVersions(packageValue.devDependencies),
    ...getPackageVersions(packageValue.dependencies),
  ])
}

function parseNpmSpecifier(specifier: string): NpmSpecifier {
  if (specifier.length > 512 || /^[A-Za-z][A-Za-z\d+.-]*:/.test(specifier)) {
    throw new Error(`Unsupported external module specifier: ${specifier}`)
  }
  if (
    specifier.startsWith('#') ||
    specifier.includes('\\') ||
    /%(?:2f|5c)/i.test(specifier)
  ) {
    throw new Error(`Unsupported external module specifier: ${specifier}`)
  }

  const queryIndex = specifier.indexOf('?')
  const path = queryIndex === -1 ? specifier : specifier.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : specifier.slice(queryIndex)
  if (
    path.includes('%') ||
    path.includes('#') ||
    hasControlCharacter(path) ||
    query.includes('#') ||
    hasControlCharacter(query)
  ) {
    throw new Error(`Unsupported external module specifier: ${specifier}`)
  }

  const segments = path.split('/')
  const packageName = path.startsWith('@')
    ? `${segments[0] ?? ''}/${segments[1] ?? ''}`
    : (segments[0] ?? '')
  const packageSegmentCount = path.startsWith('@') ? 2 : 1
  const subpathSegments = segments.slice(packageSegmentCount)

  if (
    !isValidPackageName(packageName) ||
    subpathSegments.some(
      (segment) => !segment || segment === '.' || segment === '..',
    )
  ) {
    throw new Error(`Unsupported external module specifier: ${specifier}`)
  }

  return {
    packageName,
    query,
    specifier,
    subpath: subpathSegments.join('/'),
  }
}

function tryParseNpmSpecifier(specifier: string) {
  try {
    return parseNpmSpecifier(specifier)
  } catch {
    return undefined
  }
}

function isValidPackageName(packageName: string) {
  if (packageName.length > 214) return false
  if (packageName.startsWith('@')) {
    const parts = packageName.slice(1).split('/')
    return (
      parts.length === 2 && parts.every((part) => packagePartPattern.test(part))
    )
  }
  return packagePartPattern.test(packageName)
}

function hasControlCharacter(value: string) {
  for (const character of value) {
    const code = character.charCodeAt(0)
    if (code <= 31 || code === 127) return true
  }
  return false
}

function validateRequestedVersion(packageName: string, version: string) {
  if (
    version.length > 128 ||
    version.trim() !== version ||
    !requestedVersionPattern.test(version)
  ) {
    throw new Error(`Unsupported version for ${packageName}: ${version}`)
  }
}

function isDirectModuleSpecifier(specifier: string) {
  return (
    /^(?:https?:|data:|blob:)/i.test(specifier) ||
    specifier.startsWith('.') ||
    specifier.startsWith('/')
  )
}

function isImportMapped(imports: Record<string, string>, specifier: string) {
  if (imports[specifier] !== undefined) return true
  return Object.keys(imports).some(
    (key) => key.endsWith('/') && specifier.startsWith(key),
  )
}

function hasWorkspacePackageImport(
  imports: Record<string, string>,
  packageName: string,
) {
  return Object.keys(imports).some(
    (specifier) =>
      specifier === packageName || specifier.startsWith(`${packageName}/`),
  )
}

function createEsmMetadataUrl(
  packageName: string,
  version: string,
  subpath: string,
) {
  const packagePath = `${packageName}@${encodeURIComponent(version)}`
  return `${esmOrigin}/${packagePath}${subpath ? `/${subpath}` : ''}?meta`
}

function createEsmModuleUrl(
  packageName: string,
  version: string,
  subpath: string,
  query: string,
  externalPackages: ReadonlyArray<string>,
) {
  const url = `${esmOrigin}/${packageName}@${version}${subpath ? `/${subpath}` : ''}${query}`
  return externalPackages.length
    ? appendQuery(url, `?external=${externalPackages.join(',')}`)
    : url
}

async function getEsmMetadata(
  url: string,
  metadataFetch: ExampleImportMetadataFetch | undefined,
  signal: AbortSignal | undefined,
) {
  if (metadataFetch || signal) {
    return requestEsmMetadata(url, metadataFetch ?? globalThis.fetch, signal)
  }

  const cached = metadataCache.get(url)
  if (cached) return cached

  const request = requestEsmMetadata(url, globalThis.fetch, undefined).catch(
    (error) => {
      metadataCache.delete(url)
      throw error
    },
  )
  metadataCache.set(url, request)
  return request
}

async function requestEsmMetadata(
  url: string,
  metadataFetch: ExampleImportMetadataFetch,
  signal: AbortSignal | undefined,
) {
  const response = await metadataFetch(url, {
    headers: { Accept: 'application/json' },
    signal: getMetadataSignal(signal),
  })
  if (!response.ok) {
    throw new Error(`esm.sh could not resolve ${url}: HTTP ${response.status}`)
  }

  const source = await readLimitedResponse(response)
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error(`esm.sh returned invalid metadata for ${url}`)
  }
  if (!isRecord(value)) {
    throw new Error(`esm.sh returned an invalid version for ${url}`)
  }

  const version = getString(value.version)
  const peerImports = value.peerImports ?? []
  if (
    !exactVersionPattern.test(version) ||
    !isStringArray(peerImports) ||
    peerImports.length > externalSpecifierLimit
  ) {
    throw new Error(`esm.sh returned invalid metadata for ${url}`)
  }

  return { version, peerImports }
}

async function getPackageManifest(
  packageName: string,
  exactVersion: string,
  metadataFetch: ExampleImportMetadataFetch | undefined,
  signal: AbortSignal | undefined,
) {
  const cacheKey = `${packageName}@${exactVersion}`
  if (metadataFetch || signal) {
    return requestPackageManifest(
      packageName,
      exactVersion,
      metadataFetch ?? globalThis.fetch,
      signal,
    )
  }

  const cached = packageManifestCache.get(cacheKey)
  if (cached) return cached

  const request = requestPackageManifest(
    packageName,
    exactVersion,
    globalThis.fetch,
    undefined,
  ).catch((error) => {
    packageManifestCache.delete(cacheKey)
    throw error
  })
  packageManifestCache.set(cacheKey, request)
  return request
}

async function requestPackageManifest(
  packageName: string,
  exactVersion: string,
  metadataFetch: ExampleImportMetadataFetch,
  signal: AbortSignal | undefined,
): Promise<PackageManifestMetadata> {
  const url = `${unpkgOrigin}/${packageName}@${exactVersion}/package.json`
  const response = await metadataFetch(url, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: getMetadataSignal(signal),
  })
  if (!response.ok) {
    throw new Error(
      `UNPKG could not resolve ${packageName}@${exactVersion}: HTTP ${response.status}`,
    )
  }

  const source = await readLimitedResponse(response)
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    throw new Error(`UNPKG returned invalid metadata for ${packageName}`)
  }
  if (!isRecord(value)) {
    throw new Error(`UNPKG returned invalid metadata for ${packageName}`)
  }

  const peerPackages = getPackageVersions(value.peerDependencies).map(
    ([peerPackage]) => peerPackage,
  )
  if (
    peerPackages.length > externalSpecifierLimit ||
    peerPackages.some((peerPackage) => !isValidPackageName(peerPackage))
  ) {
    throw new Error(`UNPKG returned invalid metadata for ${packageName}`)
  }

  return { peerPackages }
}

function getMetadataSignal(signal: AbortSignal | undefined) {
  const timeout = AbortSignal.timeout(esmMetadataTimeout)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

async function readLimitedResponse(response: Response) {
  const contentLength = Number(response.headers.get('content-length'))
  if (
    Number.isFinite(contentLength) &&
    contentLength > packageMetadataResponseLimit
  ) {
    throw new Error('Package metadata response is too large')
  }
  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let source = ''
  let size = 0

  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    size += chunk.value.byteLength
    if (size > packageMetadataResponseLimit) {
      await reader.cancel()
      throw new Error('Package metadata response is too large')
    }
    source += decoder.decode(chunk.value, { stream: true })
  }

  return source + decoder.decode()
}

function parsePeerImport(peerImport: string) {
  if (!peerImport.startsWith('/')) {
    const specifier = tryParseNpmSpecifier(peerImport)
    return specifier
      ? { packageName: specifier.packageName, specifier: specifier.specifier }
      : undefined
  }

  const path = peerImport.slice(1).split(/[?#]/, 1)[0] ?? ''
  const packageEnd = getPeerPackageEnd(path)
  const packageName = path.slice(0, packageEnd)
  if (!isValidPackageName(packageName)) return undefined

  const remainderStart = path.indexOf('/', packageEnd)
  if (remainderStart === -1) return { packageName, specifier: packageName }

  const remainder = path.slice(remainderStart + 1)
  const firstSegment = remainder.split('/', 1)[0] ?? ''
  if (/^(?:browser|deno|es\d+|esnext|node|worker)$/.test(firstSegment)) {
    return { packageName, specifier: packageName }
  }

  const specifier = tryParseNpmSpecifier(`${packageName}/${remainder}`)
  return specifier ? { packageName, specifier: specifier.specifier } : undefined
}

function getPeerPackageEnd(path: string) {
  if (path.startsWith('@')) {
    const scopeEnd = path.indexOf('/')
    if (scopeEnd === -1) return path.length
    const versionStart = path.indexOf('@', scopeEnd + 1)
    const subpathStart = path.indexOf('/', scopeEnd + 1)
    if (versionStart !== -1) return versionStart
    return subpathStart === -1 ? path.length : subpathStart
  }

  const versionStart = path.indexOf('@')
  const subpathStart = path.indexOf('/')
  if (versionStart !== -1) return versionStart
  return subpathStart === -1 ? path.length : subpathStart
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function isStringArray(value: unknown): value is Array<string> {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function getPackageVersions(value: unknown) {
  if (!isRecord(value)) return []

  return Object.entries(value).filter(
    (dependency): dependency is [string, string] =>
      typeof dependency[1] === 'string',
  )
}

function isPackageImported(
  name: string,
  externalSpecifiers: ReadonlySet<string>,
) {
  for (const specifier of externalSpecifiers) {
    if (specifier === name || specifier.startsWith(`${name}/`)) return true
  }

  return false
}

function removePackageImports(imports: Record<string, string>, name: string) {
  for (const specifier of Object.keys(imports)) {
    if (specifier === name || specifier.startsWith(`${name}/`)) {
      delete imports[specifier]
    }
  }
}

function getPackageExternalQuery(name: string, hasReact: boolean) {
  if (!hasReact || name === 'react') return ''
  if (name === 'react-dom') return '?external=react'
  return '?external=react,react-dom'
}

function appendQuery(url: string, query: string) {
  if (!query) return url
  return `${url}${url.includes('?') ? '&' : '?'}${query.slice(1)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
