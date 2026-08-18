import {
  createSharedExampleProject,
  parseSharedExampleProject,
  serializeSharedExampleProject,
  type SharedExampleProject,
} from './example-project'
import { createExampleWorkspace } from './example-workspace'
import { notebookStarterSource } from './notebook-environment'
import { notebookExamples, type NotebookExample } from './notebook-examples'
import { isNotebookRecordTimestamp } from './notebook-record'

export const notebookDraftStorageKey = 'tanstack.notebook.draft.v1'

export type NotebookDraft = {
  id: string
  project: SharedExampleProject
  updatedAt: string
}

type NotebookDraftStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

export function getBrowserNotebookDraftStorage() {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export const blankNotebookProject = createNotebookTemplateProject({
  title: 'Untitled notebook',
  description: '',
  source: notebookStarterSource,
})

export function createNotebookDraftId() {
  return crypto.randomUUID()
}

export function createNotebookProjectFromTemplateId(templateId: string) {
  if (templateId === 'blank') return blankNotebookProject
  const example = notebookExamples.find(({ id }) => id === templateId)
  return example ? createNotebookTemplateProject(example) : undefined
}

export function createNotebookTemplateProject({
  title,
  description,
  source,
}: Pick<NotebookExample, 'title' | 'description' | 'source'>) {
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

export function loadNotebookDraft(
  storage: NotebookDraftStorage | undefined,
): NotebookDraft | undefined {
  if (!storage) return undefined
  try {
    const source = storage.getItem(notebookDraftStorageKey)
    if (!source) return undefined
    return parseNotebookDraft(JSON.parse(source))
  } catch {
    clearNotebookDraft(storage)
    return undefined
  }
}

export function saveNotebookDraft(
  storage: NotebookDraftStorage | undefined,
  draft: Pick<NotebookDraft, 'id' | 'project'>,
  updatedAt = new Date().toISOString(),
) {
  if (!storage) return false
  try {
    const canonicalProject: unknown = JSON.parse(
      serializeSharedExampleProject(draft.project),
    )
    storage.setItem(
      notebookDraftStorageKey,
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

export function clearNotebookDraft(storage: NotebookDraftStorage | undefined) {
  if (!storage) return false
  try {
    storage.removeItem(notebookDraftStorageKey)
    return true
  } catch {
    return false
  }
}

function parseNotebookDraft(value: unknown): NotebookDraft {
  if (
    isRecord(value) &&
    hasOnlyKeys(value, ['version', 'project', 'updatedAt']) &&
    value.version === 1 &&
    typeof value.updatedAt === 'string' &&
    isNotebookRecordTimestamp(value.updatedAt) &&
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
    !isNotebookRecordTimestamp(value.updatedAt) ||
    !('project' in value)
  ) {
    throw new Error('Invalid notebook draft')
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
