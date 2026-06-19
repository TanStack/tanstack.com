import type {
  BuilderCompileManifestInput,
  BuilderFileBlob,
  BuilderFileEncoding,
  BuilderFileSource,
  BuilderLocalFileBlob,
  BuilderLocalManifestBundle,
  BuilderManifestChangeSummary,
  BuilderManifest,
  BuilderManifestApp,
  BuilderManifestFileDiffLine,
  BuilderManifestFile,
  BuilderManifestSource,
  BuilderPackageManager,
} from '~/builder/schema'
import { normalizeFrameworkId } from '~/builder/frameworks'

const BASE64_PREFIX = 'base64::'
const DEFAULT_PREVIEW_PORT = 3000
const WORKDIR = '/workspace'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item))
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      result[key] = stableValue(value[key])
    }
    return result
  }

  return value
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value))
}

function sortStringRecord(
  record: Record<string, string>,
): Record<string, string> {
  const sorted: Record<string, string> = {}
  for (const key of Object.keys(record).sort()) {
    sorted[key] = record[key]
  }
  return sorted
}

function getPackageManager(
  value?: BuilderPackageManager,
): BuilderPackageManager {
  return value ?? 'pnpm'
}

function getInstallCommand(packageManager: BuilderPackageManager): string {
  return `${packageManager} install`
}

function getDevCommand(packageManager: BuilderPackageManager): string {
  if (packageManager === 'npm') {
    return 'npm run dev'
  }

  return `${packageManager} dev`
}

function getEncoding(content: string): BuilderFileEncoding {
  return content.startsWith(BASE64_PREFIX) ? 'base64' : 'utf8'
}

function getBase64ByteSize(content: string): number {
  const base64 = content.slice(BASE64_PREFIX.length)
  const normalized = base64.replace(/=+$/, '')
  return Math.floor((normalized.length * 3) / 4)
}

function getContentSize(
  content: string,
  encoding: BuilderFileEncoding,
): number {
  if (encoding === 'base64') {
    return getBase64ByteSize(content)
  }

  return new TextEncoder().encode(content).byteLength
}

function getContentType(path: string): string {
  if (path.endsWith('.css')) return 'text/css'
  if (path.endsWith('.html')) return 'text/html'
  if (path.endsWith('.js') || path.endsWith('.mjs')) return 'text/javascript'
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.svg')) return 'image/svg+xml'
  if (path.endsWith('.png')) return 'image/png'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.webp')) return 'image/webp'
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'text/typescript'
  if (path.endsWith('.md') || path.endsWith('.mdx')) return 'text/markdown'
  return 'text/plain'
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  )

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function createLocalFileBlob(
  path: string,
  content: string,
): Promise<BuilderLocalFileBlob> {
  const encoding = getEncoding(content)
  const sha256 = await sha256Hex(`${encoding}:${content}`)

  return {
    blobRef: `local-file-sha256:${sha256}`,
    sha256,
    size: getContentSize(content, encoding),
    contentType: getContentType(path),
    encoding,
    kind: 'file',
    content,
  }
}

function createManifestFile(
  path: string,
  blob: BuilderFileBlob,
  source: BuilderFileSource,
): BuilderManifestFile {
  return {
    path,
    blobRef: blob.blobRef,
    sha256: blob.sha256,
    size: blob.size,
    contentType: blob.contentType,
    encoding: blob.encoding,
    source,
  }
}

export async function createLocalBuilderManifestBundle({
  definition,
  compile,
  createdAt,
  sessionId,
  projectId,
}: BuilderCompileManifestInput): Promise<BuilderLocalManifestBundle> {
  return createLocalBuilderManifestBundleFromFiles({
    compile,
    createdAt,
    definition,
    fileSource: 'builder-definition',
    files: compile.files,
    projectId,
    sessionId,
  })
}

export async function createLocalBuilderManifestBundleFromFiles({
  definition,
  compile,
  createdAt,
  sessionId,
  projectId,
  files: inputFiles,
  fileSource,
  fileSources,
  createdByRunId,
  parentManifestVersionId,
}: BuilderCompileManifestInput & {
  createdByRunId?: string
  fileSource: BuilderFileSource
  fileSources?: Record<string, BuilderFileSource>
  files: Record<string, string>
  parentManifestVersionId?: string
}): Promise<BuilderLocalManifestBundle> {
  const framework = normalizeFrameworkId(definition.framework)
  const packageManager = getPackageManager(definition.packageManager)
  const selectedFeatures = [...definition.features].sort()
  const sortedFeatureOptions = stableStringify(definition.featureOptions)
  const builderDefinitionRef = `local-builder-definition-sha256:${await sha256Hex(
    stableStringify(definition),
  )}`

  const blobs: Record<string, BuilderLocalFileBlob> = {}
  const files: Record<string, BuilderManifestFile> = {}

  for (const path of Object.keys(inputFiles).sort()) {
    const blob = await createLocalFileBlob(path, inputFiles[path])
    blobs[blob.blobRef] = blob
    files[path] = createManifestFile(
      path,
      blob,
      fileSources?.[path] ?? fileSource,
    )
  }

  const app: BuilderManifestApp = {
    name: definition.name,
    packageManager,
    framework,
    uiFramework: framework,
    tailwind: definition.tailwind ?? true,
    templateId: definition.customTemplate?.id,
  }

  const source: BuilderManifestSource = {
    kind: 'builder-definition',
    builderDefinitionRef,
    compileVersion: 1,
    selectedFeatures,
    selectedExample: definition.selectedExample,
    featureOptionsRef: `local-feature-options-sha256:${await sha256Hex(
      sortedFeatureOptions,
    )}`,
  }

  const dependencies = sortStringRecord(compile.packages.dependencies)
  const devDependencies = sortStringRecord(compile.packages.devDependencies)
  const scripts = sortStringRecord(compile.packages.scripts)

  const fingerprint = await sha256Hex(
    stableStringify({
      app,
      source,
      sandbox: {
        workdir: WORKDIR,
        installCommand: getInstallCommand(packageManager),
        devCommand: getDevCommand(packageManager),
        previewPort: DEFAULT_PREVIEW_PORT,
      },
      dependencies,
      devDependencies,
      scripts,
      envVars: compile.envVars,
      commands: compile.commands,
      warnings: compile.warnings,
      files,
    }),
  )

  const manifest: BuilderManifest = {
    schemaVersion: 1,
    manifestVersionId: `local-manifest-sha256:${fingerprint}`,
    projectId,
    sessionId,
    parentManifestVersionId,
    createdAt,
    createdByRunId,
    app,
    source,
    sandbox: {
      workdir: WORKDIR,
      installCommand: getInstallCommand(packageManager),
      devCommand: getDevCommand(packageManager),
      previewPort: DEFAULT_PREVIEW_PORT,
    },
    dependencies,
    devDependencies,
    scripts,
    envVars: compile.envVars,
    commands: compile.commands,
    warnings: compile.warnings,
    files,
  }

  return {
    manifest,
    blobs,
  }
}

export async function createLocalBuilderManifestBundleFromManifestFiles({
  createdAt,
  createdByRunId,
  fileSource,
  fileSources,
  files: inputFiles,
  manifest: baseManifest,
  parentManifestVersionId,
}: {
  createdAt: string
  createdByRunId?: string
  fileSource: BuilderFileSource
  fileSources?: Record<string, BuilderFileSource>
  files: Record<string, string>
  manifest: BuilderManifest
  parentManifestVersionId?: string
}): Promise<BuilderLocalManifestBundle> {
  const blobs: Record<string, BuilderLocalFileBlob> = {}
  const files: Record<string, BuilderManifestFile> = {}

  for (const path of Object.keys(inputFiles).sort()) {
    const blob = await createLocalFileBlob(path, inputFiles[path])
    blobs[blob.blobRef] = blob
    files[path] = createManifestFile(
      path,
      blob,
      fileSources?.[path] ?? baseManifest.files[path]?.source ?? fileSource,
    )
  }

  const dependencies = sortStringRecord(baseManifest.dependencies)
  const devDependencies = sortStringRecord(baseManifest.devDependencies)
  const scripts = sortStringRecord(baseManifest.scripts)
  const sandbox = {
    ...baseManifest.sandbox,
    previewPort: DEFAULT_PREVIEW_PORT,
  }

  const fingerprint = await sha256Hex(
    stableStringify({
      app: baseManifest.app,
      source: baseManifest.source,
      sandbox,
      dependencies,
      devDependencies,
      scripts,
      envVars: baseManifest.envVars,
      commands: baseManifest.commands,
      warnings: baseManifest.warnings,
      files,
    }),
  )

  return {
    blobs,
    manifest: {
      ...baseManifest,
      createdAt,
      createdByRunId,
      dependencies,
      devDependencies,
      files,
      manifestVersionId: `local-manifest-sha256:${fingerprint}`,
      parentManifestVersionId:
        parentManifestVersionId ?? baseManifest.manifestVersionId,
      sandbox,
      scripts,
    },
  }
}

export function getLocalManifestFiles(
  bundle: BuilderLocalManifestBundle,
): Record<string, string> {
  const files: Record<string, string> = {}

  for (const path of Object.keys(bundle.manifest.files).sort()) {
    const file = bundle.manifest.files[path]
    const blob = bundle.blobs[file.blobRef]
    if (blob) {
      files[path] = blob.content
    }
  }

  return files
}

export function summarizeLocalManifestChanges({
  files,
  manifest,
  parentFiles,
  parentManifest,
}: {
  files: Record<string, string>
  manifest: BuilderManifest
  parentFiles?: Record<string, string>
  parentManifest?: BuilderManifest
}): BuilderManifestChangeSummary {
  const filePaths = new Set([
    ...Object.keys(parentManifest?.files ?? {}),
    ...Object.keys(manifest.files),
  ])
  const changes: BuilderManifestChangeSummary['files'] = []

  for (const filePath of Array.from(filePaths).sort()) {
    const file = manifest.files[filePath]
    const parentFile = parentManifest?.files[filePath]
    const source = file?.source ?? parentFile?.source

    if (file && parentFile && file.sha256 === parentFile.sha256) {
      continue
    }

    if (!source) {
      continue
    }

    const status = !parentFile ? 'added' : file ? 'modified' : 'deleted'
    const counts = countContentChanges({
      after: file ? files[filePath] : undefined,
      afterFile: file,
      before: parentFiles?.[filePath],
      beforeFile: parentFile,
    })

    changes.push({
      additions: counts.additions,
      deletions: counts.deletions,
      diffLines: counts.diffLines,
      path: filePath,
      previousSource: parentFile?.source,
      source,
      status,
    })
  }

  const additions = changes.reduce((total, change) => {
    return total + change.additions
  }, 0)
  const deletions = changes.reduce((total, change) => {
    return total + change.deletions
  }, 0)

  return {
    additions,
    changedFileCount: changes.length,
    deletions,
    files: changes,
    manifestVersionId: manifest.manifestVersionId,
    parentManifestVersionId: manifest.parentManifestVersionId,
  }
}

export function getLocalManifestTotalBytes(manifest: BuilderManifest): number {
  return Object.values(manifest.files).reduce((total, file) => {
    return total + file.size
  }, 0)
}

function countContentChanges({
  after,
  afterFile,
  before,
  beforeFile,
}: {
  after?: string
  afterFile?: BuilderManifestFile
  before?: string
  beforeFile?: BuilderManifestFile
}): {
  additions: number
  deletions: number
  diffLines: Array<BuilderManifestFileDiffLine>
} {
  const beforeLines =
    beforeFile && before !== undefined && isTextFile(beforeFile)
      ? splitDiffLines(before)
      : []
  const afterLines =
    afterFile && after !== undefined && isTextFile(afterFile)
      ? splitDiffLines(after)
      : []

  if (!beforeFile) {
    return {
      additions: afterLines.length,
      deletions: 0,
      diffLines: afterLines.map((line, index) => ({
        content: line,
        kind: 'added',
        newLineNumber: index + 1,
      })),
    }
  }

  if (!afterFile) {
    return {
      additions: 0,
      deletions: beforeLines.length,
      diffLines: beforeLines.map((line, index) => ({
        content: line,
        kind: 'deleted',
        oldLineNumber: index + 1,
      })),
    }
  }

  if (!isTextFile(beforeFile) || !isTextFile(afterFile)) {
    return {
      additions: 0,
      deletions: 0,
      diffLines: [],
    }
  }

  const diffLines = createDiffLines(beforeLines, afterLines)
  const additions = diffLines.filter((line) => line.kind === 'added').length
  const deletions = diffLines.filter((line) => line.kind === 'deleted').length

  return {
    additions,
    deletions,
    diffLines,
  }
}

function isTextFile(file: BuilderManifestFile) {
  return file.encoding === 'utf8'
}

function splitDiffLines(value: string) {
  if (!value) {
    return []
  }

  const lines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  if (lines.at(-1) === '') {
    lines.pop()
  }

  return lines
}

function createDiffLines(
  beforeLines: Array<string>,
  afterLines: Array<string>,
): Array<BuilderManifestFileDiffLine> {
  const table = Array.from({ length: beforeLines.length + 1 }, () =>
    Array<number>(afterLines.length + 1).fill(0),
  )

  for (
    let beforeIndex = beforeLines.length - 1;
    beforeIndex >= 0;
    beforeIndex--
  ) {
    for (
      let afterIndex = afterLines.length - 1;
      afterIndex >= 0;
      afterIndex--
    ) {
      table[beforeIndex][afterIndex] =
        beforeLines[beforeIndex] === afterLines[afterIndex]
          ? (table[beforeIndex + 1]?.[afterIndex + 1] ?? 0) + 1
          : Math.max(
              table[beforeIndex + 1]?.[afterIndex] ?? 0,
              table[beforeIndex]?.[afterIndex + 1] ?? 0,
            )
    }
  }

  const diffLines: Array<BuilderManifestFileDiffLine> = []
  let beforeIndex = 0
  let afterIndex = 0

  while (beforeIndex < beforeLines.length || afterIndex < afterLines.length) {
    if (
      beforeIndex < beforeLines.length &&
      afterIndex < afterLines.length &&
      beforeLines[beforeIndex] === afterLines[afterIndex]
    ) {
      diffLines.push({
        content: beforeLines[beforeIndex],
        kind: 'context',
        newLineNumber: afterIndex + 1,
        oldLineNumber: beforeIndex + 1,
      })
      beforeIndex += 1
      afterIndex += 1
      continue
    }

    if (
      afterIndex < afterLines.length &&
      (beforeIndex >= beforeLines.length ||
        (table[beforeIndex]?.[afterIndex + 1] ?? 0) >=
          (table[beforeIndex + 1]?.[afterIndex] ?? 0))
    ) {
      diffLines.push({
        content: afterLines[afterIndex],
        kind: 'added',
        newLineNumber: afterIndex + 1,
      })
      afterIndex += 1
      continue
    }

    if (beforeIndex < beforeLines.length) {
      diffLines.push({
        content: beforeLines[beforeIndex],
        kind: 'deleted',
        oldLineNumber: beforeIndex + 1,
      })
      beforeIndex += 1
    }
  }

  return diffLines
}

export function decodeLocalBase64File(content: string): Uint8Array | null {
  if (!content.startsWith(BASE64_PREFIX)) {
    return null
  }

  const decoded = atob(content.slice(BASE64_PREFIX.length))
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0))
}
