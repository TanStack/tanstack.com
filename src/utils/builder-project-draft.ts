import {
  createSharedExampleProject,
  parseSharedExampleProject,
  serializeSharedExampleProject,
  type SharedExampleProject,
} from './example-project'
import { createExampleWorkspace } from './example-workspace'
import { builderStarterSource } from './builder-environment'
import { builderExamples, type BuilderExample } from './builder-examples'
import { isBuilderProjectTimestamp } from './builder-project'

export const builderProjectDraftStorageKey = 'tanstack.builder.draft.v1'

export type BuilderProjectDraft = {
  id: string
  project: SharedExampleProject
  updatedAt: string
}

type BuilderProjectDraftStorage = Pick<
  Storage,
  'getItem' | 'removeItem' | 'setItem'
>

export function getBrowserBuilderProjectDraftStorage() {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export const blankBuilderProject = createBuilderTemplateProject({
  title: 'Untitled project',
  description: '',
  source: builderStarterSource,
})

export function createBuilderProjectDraftId() {
  return crypto.randomUUID()
}

export function createBuilderProjectFromTemplateId(templateId: string) {
  if (templateId === 'blank') return blankBuilderProject
  const example = builderExamples.find(({ id }) => id === templateId)
  return example ? createBuilderTemplateProject(example) : undefined
}

export function createBuilderTemplateProject({
  title,
  description,
  source,
}: Pick<BuilderExample, 'title' | 'description' | 'source'>) {
  return createSharedExampleProject({
    title,
    description,
    initialFile: '/index.tsx',
    workspace: createExampleWorkspace({
      entry: '/index.tsx',
      environment: 'client',
      files: { '/index.tsx': source },
    }),
  })
}

export function loadBuilderProjectDraft(
  storage: BuilderProjectDraftStorage | undefined,
): BuilderProjectDraft | undefined {
  if (!storage) return undefined
  try {
    const source = storage.getItem(builderProjectDraftStorageKey)
    if (!source) return undefined
    return parseBuilderProjectDraft(JSON.parse(source))
  } catch {
    clearBuilderProjectDraft(storage)
    return undefined
  }
}

export function saveBuilderProjectDraft(
  storage: BuilderProjectDraftStorage | undefined,
  draft: Pick<BuilderProjectDraft, 'id' | 'project'>,
  updatedAt = new Date().toISOString(),
) {
  if (!storage) return false
  try {
    const canonicalProject: unknown = JSON.parse(
      serializeSharedExampleProject(draft.project),
    )
    storage.setItem(
      builderProjectDraftStorageKey,
      JSON.stringify({
        version: 2,
        id: draft.id,
        project: canonicalProject,
        updatedAt,
      }),
    )
    return true
  } catch {
    return false
  }
}

export function clearBuilderProjectDraft(
  storage: BuilderProjectDraftStorage | undefined,
) {
  if (!storage) return false
  try {
    storage.removeItem(builderProjectDraftStorageKey)
    return true
  } catch {
    return false
  }
}

function parseBuilderProjectDraft(value: unknown): BuilderProjectDraft {
  if (
    isRecord(value) &&
    hasOnlyKeys(value, ['version', 'project', 'updatedAt']) &&
    value.version === 1 &&
    typeof value.updatedAt === 'string' &&
    isBuilderProjectTimestamp(value.updatedAt) &&
    'project' in value
  ) {
    return {
      id: `legacy-${value.updatedAt}`,
      project: parseSharedExampleProject(value.project),
      updatedAt: value.updatedAt,
    }
  }

  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['version', 'id', 'project', 'updatedAt']) ||
    value.version !== 2 ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    value.id.length > 200 ||
    typeof value.updatedAt !== 'string' ||
    !isBuilderProjectTimestamp(value.updatedAt) ||
    !('project' in value)
  ) {
    throw new Error('Invalid builder draft')
  }

  return {
    id: value.id,
    project: parseSharedExampleProject(value.project),
    updatedAt: value.updatedAt,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: Array<string>) {
  return Object.keys(value).every((key) => keys.includes(key))
}
