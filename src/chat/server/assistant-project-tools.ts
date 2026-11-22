import { projectSavedEvent } from '../core/project-events'
import {
  toolDefinition,
  type ChatMiddlewareConfig,
  type ToolExecutionContext,
} from '@tanstack/ai'
import { z } from 'zod'
import { resolveConversationIdentity } from '../conversation-identity.server'
import type { ReferenceScope } from './message-references'
import {
  getBuilderProjectState,
  getBuilderProjectMutationRequestHash,
  updateBuilderProjectState,
  getBuilderProjectRevisionForMutation,
  preflightBuilderProjectCreation,
  createBuilderProjectState,
} from '~/utils/builder-project-events.server'
import { blankBuilderProject } from '~/utils/builder-project-draft'
import {
  listOrImportBuilderProjectStates,
  reserveLegacyBuilderProjectId,
} from '~/utils/builder-project-state.server'
import { checkUserWindowRateLimit, RATE_LIMITS } from '~/utils/rateLimit.server'
import { getBuilderProjectSnapshotHash } from '~/utils/builder-project-snapshot-storage.server'
import { readBuilderProjectSnapshot } from '~/utils/builder-project-snapshot-storage.server'
import { stableOperationId } from './crypto'
import { createWorkspaceTools } from '~/utils/builder-workspace-tools.server'
import { createBuilderAiProgressGate } from '~/utils/builder-ai-progress'
import type { BuilderAiExecution } from '~/utils/builder-ai'
import { storeBuilderProjectSnapshotForOwner } from '~/utils/builder-project-snapshot-registry.server'
import {
  listBuilderAiFiles,
  readBuilderAiFile,
} from '~/utils/builder-ai-workspace'

/** Use the shared project store, never model-supplied account identity. */
export function assistantProjectTools({
  scope,
  assertCurrent,
  taskId,
}: {
  scope: ReferenceScope
  taskId: string
  assertCurrent: () => void
}) {
  const authorize = async () => {
    assertCurrent()
    if (scope.workspaceId !== `personal:${scope.userId}`)
      throw new Error('Personal projects are unavailable in this workspace.')
    await resolveConversationIdentity(scope)
    assertCurrent()
  }
  const snapshot = async (projectId: string) => {
    const project = await getBuilderProjectState({
      projectId,
      ownerId: scope.userId,
    })
    const contents = await readBuilderProjectSnapshot(project.snapshotHash)
    assertCurrent()
    if (!contents) throw new Error('Project snapshot is unavailable.')
    return { project, contents }
  }
  const list = toolDefinition({
    name: 'list_projects',
    description:
      'List your saved TanStack projects. Returns project IDs and current revisions. These are software projects, separate from conversations and saved chat files.',
    inputSchema: z.object({}).strict(),
  }).server(async () => {
    await authorize()
    const projects = await listOrImportBuilderProjectStates(scope.userId)
    assertCurrent()
    return {
      projects: projects.map((project) => ({
        id: project.id,
        title: project.title,
        description: project.description,
        revision: project.currentRevisionNumber,
        updatedAt: project.updatedAt,
      })),
    }
  })
  const inspect = toolDefinition({
    name: 'inspect_project',
    description:
      'Inspect one saved TanStack project by its exact ID from list_projects. Returns its current revision, runtime, entry point and readable file paths, without running code or changing the project.',
    inputSchema: z.object({ projectId: z.string().uuid() }).strict(),
  }).server(async ({ projectId }) => {
    await authorize()
    const { project, contents } = await snapshot(projectId)
    return {
      id: project.id,
      title: project.title,
      description: project.description,
      revision: project.currentRevisionNumber,
      snapshotHash: project.snapshotHash,
      runtime: contents.runtime ?? null,
      entry: contents.workspace.entry,
      files: listBuilderAiFiles(contents.workspace, contents.hiddenFiles ?? []),
      updatedAt: project.updatedAt,
    }
  })
  const read = toolDefinition({
    name: 'read_project_file',
    description:
      'Read a saved TanStack project text file using its exact project ID and a path from inspect_project. Reads up to 50,000 characters, use nextOffset to continue. This reads persisted source, it does not execute code.',
    inputSchema: z
      .object({
        projectId: z.string().uuid(),
        path: z.string().min(1).max(512),
        offset: z.number().int().nonnegative().default(0),
      })
      .strict(),
  }).server(async ({ projectId, path, offset = 0 }) => {
    await authorize()
    const { project, contents } = await snapshot(projectId)
    const source = readBuilderAiFile(
      contents.workspace,
      contents.hiddenFiles ?? [],
      path,
    )
    if (offset > source.length)
      throw new Error('Read offset exceeds file length.')
    const end = Math.min(source.length, offset + 50_000)
    return {
      projectId: project.id,
      revision: project.currentRevisionNumber,
      snapshotHash: project.snapshotHash,
      path,
      content: source.slice(offset, end),
      offset,
      totalCharacters: source.length,
      nextOffset: end < source.length ? end : null,
    }
  })
  const reviseProject = async (
    projectId: string,
    expectedRevision: number,
    toolName: 'replace_file' | 'upgrade_runtime' | 'install_dependency',
    toolArgs: object,
    context?: {
      toolCallId?: string
      abortSignal?: AbortSignal
      emitCustomEvent?: ToolExecutionContext['emitCustomEvent']
    },
  ) => {
    await authorize()
    if (!context?.toolCallId)
      throw new Error('Project edit identity is unavailable.')
    context.abortSignal?.throwIfAborted()
    const clientMutationId = await stableOperationId([
      'chat-project-edit',
      scope,
      taskId,
      context.toolCallId,
    ])
    const revisionId = await stableOperationId([
      'chat-project-revision',
      clientMutationId,
    ])
    const requestHash = await getBuilderProjectMutationRequestHash({
      type: 'project.revise',
      scope,
      taskId,
      toolCallId: context.toolCallId,
      args:
        toolName === 'replace_file'
          ? { projectId, expectedRevision, ...toolArgs }
          : { projectId, expectedRevision, toolName, ...toolArgs },
    })
    const replay = await getBuilderProjectRevisionForMutation({
      projectId: projectId,
      ownerId: scope.userId,
      clientMutationId,
      requestHash,
    })
    assertCurrent()
    if (replay) {
      context.emitCustomEvent?.(projectSavedEvent, {
        projectId,
        revision: replay.revisionNumber,
      })
      return {
        projectId: projectId,
        revision: replay.revisionNumber,
        snapshotHash: replay.snapshotHash,
      }
    }
    const { project, contents } = await snapshot(projectId)
    if (project.currentRevisionNumber !== expectedRevision)
      throw new Error(
        'Project revision changed. Inspect the project and read the file again before editing.',
      )
    let execution: BuilderAiExecution = {
      runtime: contents.runtime ?? null,
      workspace: contents.workspace,
    }
    const tools: ChatMiddlewareConfig['tools'] = createWorkspaceTools(
      () => execution,
      (next) => {
        execution = next
      },
      contents.hiddenFiles ?? [],
      context.abortSignal ?? new AbortController().signal,
      createBuilderAiProgressGate(undefined),
      () => {},
    )
    const replace = tools.find((tool) => tool.name === toolName)
    if (!replace?.execute) throw new Error('Project editing is unavailable.')
    await replace.execute(toolArgs)
    const next = {
      ...contents,
      title: project.title,
      description: project.description,
      runtime: execution.runtime ?? undefined,
      workspace: execution.workspace,
    }
    context.abortSignal?.throwIfAborted()
    assertCurrent()
    const stored = await storeBuilderProjectSnapshotForOwner(scope.userId, next)
    context.abortSignal?.throwIfAborted()
    assertCurrent()
    const updated = await updateBuilderProjectState({
      projectId: project.id,
      ownerId: scope.userId,
      clientMutationId,
      requestHash,
      revisionId,
      snapshotHash: stored.hash,
      expectedRevisionNumber: expectedRevision,
      title: project.title,
      description: project.description,
    })
    context.emitCustomEvent?.(projectSavedEvent, {
      projectId: updated.id,
      revision: updated.currentRevisionNumber,
    })
    return {
      projectId: updated.id,
      revision: updated.currentRevisionNumber,
      snapshotHash: updated.snapshotHash,
    }
  }
  const revisionInput = {
    projectId: z.string().uuid(),
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER - 1),
  }
  const edit = toolDefinition({
    name: 'replace_project_file',
    description:
      'Replace an existing saved project text file with complete contents. Read it first and supply the current revision from inspect_project. Uses the original Builder tool and ownership checks. Does not execute or deploy code.',
    inputSchema: z
      .object({
        ...revisionInput,
        path: z.string().min(1).max(512),
        content: z.string().max(512 * 1024),
      })
      .strict(),
  }).server(
    async ({ projectId, expectedRevision, path, content }, context) => ({
      ...(await reviseProject(
        projectId,
        expectedRevision,
        'replace_file',
        { path, content },
        context,
      )),
      path,
    }),
  )
  const upgrade = toolDefinition({
    name: 'upgrade_project_runtime',
    description:
      'Save the original Builder React/Vite WebContainer scaffold for a browser project. Supply its current revision. Creates the fixed runtime commands and scaffold, does not execute them or deploy.',
    inputSchema: z.object(revisionInput).strict(),
  }).server(({ projectId, expectedRevision }, context) =>
    reviseProject(projectId, expectedRevision, 'upgrade_runtime', {}, context),
  )
  const install = toolDefinition({
    name: 'install_project_dependency',
    description:
      'Add or update an npm dependency in a saved WebContainer project using the original Builder tool. Upgrade the runtime first. Provide an exact version or omit it to resolve from npm. Saves package.json only, does not execute installation or deploy.',
    inputSchema: z
      .object({
        ...revisionInput,
        name: z.string().min(1).max(214),
        version: z.string().min(1).max(128).optional(),
      })
      .strict(),
  }).server(({ projectId, expectedRevision, name, version }, context) =>
    reviseProject(
      projectId,
      expectedRevision,
      'install_dependency',
      { name, version },
      context,
    ),
  )
  const create = toolDefinition({
    name: 'create_project',
    description:
      'Create a saved TanStack software project from the existing blank starter. Returns its project ID and revision. Use inspect_project to discover the starter files, then read_project_file and replace_project_file to build it. Does not run code or deploy anything.',
    inputSchema: z
      .object({
        title: z.string().trim().min(1).max(200),
        description: z.string().max(2000).default(''),
      })
      .strict(),
  }).server(async ({ title, description = '' }, context) => {
    await authorize()
    if (!context?.toolCallId)
      throw new Error('Project creation requires a tool call identity.')
    context.abortSignal?.throwIfAborted()
    const clientMutationId = await stableOperationId([
      'chat-project-create',
      scope,
      taskId,
      context.toolCallId,
    ])
    const id = await stableOperationId(['chat-project', clientMutationId])
    const revisionId = await stableOperationId([
      'chat-project-revision',
      clientMutationId,
    ])
    const project = { ...blankBuilderProject, title, description }
    await listOrImportBuilderProjectStates(scope.userId)
    const snapshotHash = await getBuilderProjectSnapshotHash(project)
    const input = {
      id,
      ownerId: scope.userId,
      clientMutationId,
      revisionId,
      snapshotHash,
      title,
      description,
    }
    const existing = await preflightBuilderProjectCreation(input)
    if (existing) {
      context.emitCustomEvent(projectSavedEvent, {
        projectId: existing.id,
        revision: existing.currentRevisionNumber,
      })
      return {
        projectId: existing.id,
        revision: existing.currentRevisionNumber,
        snapshotHash: existing.snapshotHash,
      }
    }
    const limit = await checkUserWindowRateLimit(
      scope.userId,
      RATE_LIMITS.builderProjectCreateDaily,
    )
    if (!limit.allowed)
      throw new Error('The daily project creation limit has been reached.')
    context.abortSignal?.throwIfAborted()
    assertCurrent()
    await reserveLegacyBuilderProjectId(id)
    const stored = await storeBuilderProjectSnapshotForOwner(
      scope.userId,
      project,
    )
    context.abortSignal?.throwIfAborted()
    assertCurrent()
    const created = await createBuilderProjectState({
      ...input,
      snapshotHash: stored.hash,
    })
    context?.emitCustomEvent(projectSavedEvent, {
      projectId: created.id,
      revision: created.currentRevisionNumber,
    })
    return {
      projectId: created.id,
      revision: created.currentRevisionNumber,
      snapshotHash: created.snapshotHash,
    }
  })
  const packageInput = {
    projectId: z.string().uuid(),
    specifier: z.string().min(1).max(512),
  }
  const packageTool = async (
    projectId: string,
    name: string,
    args: object,
    signal?: AbortSignal,
  ) => {
    await authorize()
    signal?.throwIfAborted()
    const { contents } = await snapshot(projectId)
    const execution: BuilderAiExecution = {
      runtime: contents.runtime ?? null,
      workspace: contents.workspace,
    }
    const tools: ChatMiddlewareConfig['tools'] = createWorkspaceTools(
      () => execution,
      () => {
        throw new Error('Package inspection cannot change the project.')
      },
      contents.hiddenFiles ?? [],
      signal ?? new AbortController().signal,
      createBuilderAiProgressGate(undefined),
      () => {},
    )
    const tool = tools.find((item) => item.name === name)
    if (!tool?.execute)
      throw new Error('Project package inspection is unavailable.')
    const result = await tool.execute(args)
    signal?.throwIfAborted()
    assertCurrent()
    return result
  }
  const inspectModule = toolDefinition({
    name: 'inspect_project_module',
    description:
      'Inspect a saved project npm module using the existing Builder package resolver. Returns version-matched exports, declarations, and runtime source. Does not run or modify the project.',
    inputSchema: z.object(packageInput).strict(),
  }).server(({ projectId, specifier }, context) =>
    packageTool(
      projectId,
      'inspect_module',
      { specifier },
      context?.abortSignal,
    ),
  )
  const searchResources = toolDefinition({
    name: 'search_project_package_resources',
    description:
      'Find version-matched package source, docs, declarations, and permitted TanStack Intent skills for a saved project. Query matches resource paths, an empty query discovers indexes and skills.',
    inputSchema: z
      .object({ ...packageInput, query: z.string().max(120).optional() })
      .strict(),
  }).server(({ projectId, specifier, query }, context) =>
    packageTool(
      projectId,
      'search_package_resources',
      { specifier, query },
      context?.abortSignal,
    ),
  )
  const readResource = toolDefinition({
    name: 'read_project_package_resource',
    description:
      'Read a version-matched package resource found by search_project_package_resources. Returns up to 50,000 characters, use nextOffset to continue. Only TanStack packages may contribute Intent skills.',
    inputSchema: z
      .object({
        ...packageInput,
        path: z.string().min(1).max(512),
        offset: z.number().int().nonnegative().optional(),
      })
      .strict(),
  }).server(({ projectId, specifier, path, offset }, context) =>
    packageTool(
      projectId,
      'read_package_resource',
      { specifier, path, offset },
      context?.abortSignal,
    ),
  )
  return [
    list,
    inspect,
    read,
    edit,
    create,
    inspectModule,
    searchResources,
    readResource,
    upgrade,
    install,
  ] satisfies [
    typeof list,
    typeof inspect,
    typeof read,
    typeof edit,
    typeof create,
    typeof inspectModule,
    typeof searchResources,
    typeof readResource,
    typeof upgrade,
    typeof install,
  ]
}
