import type { CompileResponse, ProjectDefinition } from '~/builder/api'
import type { FrameworkId } from '~/builder/frameworks'

export type BuilderSchemaVersion = 1

export type BuilderPackageManager = 'bun' | 'npm' | 'pnpm' | 'yarn'

export type BuilderFileEncoding = 'utf8' | 'base64'

export type BuilderBlobKind =
  | 'file'
  | 'manifest'
  | 'raw-event'
  | 'context'
  | 'builder-definition'
  | 'attachment'
  | 'diff'
  | 'export'

export type BuilderFileSource =
  | 'builder-definition'
  | 'agent'
  | 'repo-import'
  | 'system'

export type BuilderRunStatus =
  | 'queued'
  | 'starting'
  | 'running'
  | 'paused'
  | 'finishing'
  | 'finished'
  | 'interrupted'
  | 'failed'
  | 'cancelled'

export type BuilderMessageStatus =
  | 'streaming'
  | 'complete'
  | 'failed'
  | 'cancelled'

export type BuilderExportKind = 'zip' | 'github'

export type BuilderExportStatus = 'running' | 'completed' | 'failed'

export type BuilderStateOperation = 'insert' | 'update' | 'delete'

export type BuilderEventType =
  | 'session.input.received'
  | 'run.queued'
  | 'run.started'
  | 'run.finished'
  | 'run.failed'
  | 'assistant.message.started'
  | 'assistant.message.delta'
  | 'assistant.message.completed'
  | 'agent.event.recorded'
  | 'workflow.event.recorded'
  | 'file.upserted'
  | 'file.deleted'
  | 'manifest.snapshotted'
  | 'export.started'
  | 'export.completed'
  | 'export.failed'

export interface BuilderFileBlob {
  blobRef: string
  sha256: string
  size: number
  contentType: string
  encoding: BuilderFileEncoding
  kind: 'file'
}

export interface BuilderLocalFileBlob extends BuilderFileBlob {
  content: string
}

export interface BuilderManifestFile {
  path: string
  blobRef: string
  sha256: string
  size: number
  contentType: string
  encoding: BuilderFileEncoding
  source: BuilderFileSource
  lastEventId?: string
}

export type BuilderManifestFileChangeStatus = 'added' | 'deleted' | 'modified'

export type BuilderManifestFileDiffLineKind = 'added' | 'context' | 'deleted'

export interface BuilderManifestFileDiffLine {
  content: string
  kind: BuilderManifestFileDiffLineKind
  newLineNumber?: number
  oldLineNumber?: number
}

export interface BuilderManifestFileChange {
  additions: number
  deletions: number
  diffLines: Array<BuilderManifestFileDiffLine>
  path: string
  previousSource?: BuilderFileSource
  source: BuilderFileSource
  status: BuilderManifestFileChangeStatus
}

export interface BuilderManifestChangeSummary {
  additions: number
  changedFileCount: number
  deletions: number
  files: Array<BuilderManifestFileChange>
  manifestVersionId: string
  parentManifestVersionId?: string
}

export interface BuilderManifestApp {
  name: string
  packageManager: BuilderPackageManager
  framework: FrameworkId
  uiFramework: FrameworkId
  tailwind: boolean
  templateId?: string
}

export interface BuilderManifestSource {
  kind: BuilderFileSource
  builderDefinitionRef?: string
  compileVersion: 1
  selectedFeatures: Array<string>
  selectedExample?: string
  featureOptionsRef?: string
}

export interface BuilderManifest {
  schemaVersion: BuilderSchemaVersion
  manifestVersionId: string
  projectId?: string
  sessionId?: string
  parentManifestVersionId?: string
  createdAt: string
  createdByRunId?: string
  app: BuilderManifestApp
  source: BuilderManifestSource
  sandbox: {
    workdir: '/workspace'
    installCommand: string
    devCommand: string
    previewPort: number
  }
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  scripts: Record<string, string>
  envVars: CompileResponse['envVars']
  commands: CompileResponse['commands']
  warnings: Array<string>
  files: Record<string, BuilderManifestFile>
}

export interface BuilderLocalManifestBundle {
  manifest: BuilderManifest
  blobs: Record<string, BuilderLocalFileBlob>
}

export interface BuilderTimelineProducer {
  id: string
  kind: 'ui' | 'agent' | 'bridge' | 'normalizer' | 'projector' | 'system'
  epoch: string
  seq: number
}

export interface BuilderTimelineEvent<TPayload = unknown> {
  schemaVersion: BuilderSchemaVersion
  eventId: string
  projectId?: string
  sessionId: string
  runId?: string
  producer: BuilderTimelineProducer
  type: BuilderEventType
  payload: TPayload
  createdAt: string
}

export interface BuilderStateEvent<TValue = unknown> {
  type: string
  key: string
  value?: TValue
  headers: {
    schemaVersion: BuilderSchemaVersion
    operation: BuilderStateOperation
    txid: string
    timestamp: string
    stateOffset: string
    timelineEventId: string
    timelineOffset: string
  }
}

export interface BuilderProjectedRowMeta {
  lastEventId: string
  lastTimelineOffset: string
  lastStateOffset?: string
}

export interface BuilderRunRow extends BuilderProjectedRowMeta {
  id: string
  sessionId: string
  status: BuilderRunStatus
  createdAt?: string
  startedAt?: string
  endedAt?: string
  error?: string
}

export interface BuilderMessageRow extends BuilderProjectedRowMeta {
  id: string
  runId?: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  status: BuilderMessageStatus
  content?: string
  createdAt: string
  completedAt?: string
}

export interface BuilderAgentEventRow extends BuilderProjectedRowMeta {
  id: string
  runId: string
  sessionId: string
  name: string
  message?: string
  detail?: string
  path?: string
  status?: BuilderRunStatus
  toolCallId?: string
  createdAt: string
  elapsedMs?: number
}

export interface BuilderWorkflowEventRow extends BuilderProjectedRowMeta {
  id: string
  runId: string
  sessionId: string
  name: string
  message?: string
  detail?: string
  path?: string
  status?: BuilderRunStatus
  createdAt: string
  elapsedMs?: number
}

export interface BuilderManifestRow extends BuilderProjectedRowMeta {
  id: string
  sessionId: string
  runId?: string
  blobRef: string
  fileCount: number
  totalBytes: number
  createdAt: string
}

export interface BuilderExportRow extends BuilderProjectedRowMeta {
  id: string
  sessionId: string
  runId?: string
  manifestVersionId: string
  status: BuilderExportStatus
  kind: BuilderExportKind
  fileName?: string
  byteLength?: number
  repoOwner?: string
  repoName?: string
  repoUrl?: string
  branch?: string
  commitSha?: string
  visibility?: 'private' | 'public'
  error?: string
  startedAt: string
  completedAt?: string
}

export interface BuilderFileRow extends BuilderProjectedRowMeta {
  id: string
  sessionId: string
  path: string
  status: 'active' | 'deleted'
  blobRef?: string
  sha256?: string
  size?: number
  contentType?: string
  encoding?: BuilderFileEncoding
  source: BuilderFileSource
  updatedAt: string
}

export interface BuilderRunRequest {
  projectId?: string
  sessionId: string
  clientRequestId: string
  input: {
    text?: string
  }
  target?: {
    manifestVersionId?: string
  }
  options?: {
    harness?: 'local'
    approvalMode?: 'mostly-allow' | 'ask-first' | 'read-only'
    preview?: 'auto' | 'manual' | 'off'
    validation?: 'none' | 'fast' | 'full'
  }
}

export interface BuilderCompileManifestInput {
  definition: ProjectDefinition
  compile: CompileResponse
  createdAt: string
  sessionId?: string
  projectId?: string
}
