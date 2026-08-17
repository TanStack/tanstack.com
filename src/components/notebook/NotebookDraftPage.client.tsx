import * as React from 'react'
import {
  ArrowLeftIcon,
  FloppyDiskIcon,
  SpinnerGapIcon,
} from '@phosphor-icons/react'
import { Link, useBlocker, useNavigate } from '@tanstack/react-router'
import { Button } from '~/components/ds/ui'
import { ExampleWorkbench } from '~/components/examples/ExampleWorkbench.client'
import { useLoginModal } from '~/contexts/LoginModalContext'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import {
  createSharedExampleProject,
  sharedProjectToExampleDefinition,
} from '~/utils/example-project'
import type { ExampleWorkspace } from '~/utils/example-workspace'
import {
  blankNotebookProject,
  clearNotebookDraft,
  createNotebookProjectFromTemplateId,
  getBrowserNotebookDraftStorage,
  loadNotebookDraft,
  saveNotebookDraft,
} from '~/utils/notebook-draft'
import { createNotebookRecord } from '~/utils/notebook-record.client'

type LocalSaveState = 'error' | 'saved' | 'saving'

export function NotebookDraftPage({ template }: { template?: string }) {
  const navigate = useNavigate()
  const { openLoginModal } = useLoginModal()
  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const [draftStorage] = React.useState(getBrowserNotebookDraftStorage)
  const [initialDraft] = React.useState(() => {
    const templateProject = template
      ? createNotebookProjectFromTemplateId(template)
      : undefined
    const storedDraft = loadNotebookDraft(draftStorage)

    if (storedDraft) {
      return { project: storedDraft.project, needsInitialSave: false }
    }

    if (templateProject) {
      return { project: templateProject, needsInitialSave: true }
    }

    return { project: blankNotebookProject, needsInitialSave: true }
  })
  const initialProject = initialDraft.project
  const [title, setTitle] = React.useState(initialProject.title)
  const [description, setDescription] = React.useState(
    initialProject.description,
  )
  const [editRevision, setEditRevision] = React.useState(0)
  const [localSaveState, setLocalSaveState] = React.useState<LocalSaveState>(
    initialDraft.needsInitialSave ? 'saving' : 'saved',
  )
  const [localError, setLocalError] = React.useState('')
  const [saveError, setSaveError] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const workspaceRef = React.useRef<ExampleWorkspace>(initialProject.workspace)
  const titleRef = React.useRef(initialProject.title)
  const descriptionRef = React.useRef(initialProject.description)
  const editRevisionRef = React.useRef(0)
  const persistedRevisionRef = React.useRef(0)
  const promotedRef = React.useRef(false)
  const savingRef = React.useRef(false)
  const draftStoredRef = React.useRef(!initialDraft.needsInitialSave)

  const definition = React.useMemo(
    () => sharedProjectToExampleDefinition('local-draft', initialProject),
    [initialProject],
  )

  const currentProject = React.useCallback(
    () =>
      createSharedExampleProject({
        title: titleRef.current.trim() || 'Untitled notebook',
        description: descriptionRef.current.trim(),
        initialFile: initialProject.initialFile,
        hiddenFiles: initialProject.hiddenFiles,
        runtime: initialProject.runtime,
        workspace: workspaceRef.current,
      }),
    [initialProject],
  )

  const persistDraft = React.useCallback(
    (updateUi = true) => {
      if (promotedRef.current) return true
      const revision = editRevisionRef.current
      const saved = saveNotebookDraft(draftStorage, currentProject())
      draftStoredRef.current = saved

      if (saved) {
        persistedRevisionRef.current = revision
        if (updateUi) {
          setLocalSaveState('saved')
          setLocalError('')
        }
      } else if (updateUi) {
        setLocalSaveState('error')
        setLocalError(
          'This browser could not store the draft. Keep this tab open or sign in to save.',
        )
      }

      return saved
    },
    [currentProject, draftStorage],
  )

  const hasUnstoredChanges = React.useCallback(
    () =>
      !promotedRef.current &&
      (!draftStoredRef.current ||
        editRevisionRef.current > persistedRevisionRef.current),
    [],
  )

  const shouldBlockBeforeUnload = React.useCallback(
    () => hasUnstoredChanges() && !persistDraft(false),
    [hasUnstoredChanges, persistDraft],
  )

  useBlocker({
    disabled: false,
    enableBeforeUnload: shouldBlockBeforeUnload,
    shouldBlockFn: () => {
      if (!hasUnstoredChanges()) return false
      return !persistDraft()
    },
  })

  React.useEffect(() => {
    document.title = `${title || 'Untitled notebook'} | TanStack`
  }, [title])

  React.useEffect(() => {
    if (!template) return
    void navigate({
      to: '/notebook/new',
      search: {},
      replace: true,
    })
  }, [navigate, template])

  React.useEffect(() => {
    if (initialDraft.needsInitialSave) persistDraft()
  }, [initialDraft.needsInitialSave, persistDraft])

  React.useEffect(() => {
    if (editRevision <= persistedRevisionRef.current) return
    const timeout = window.setTimeout(() => persistDraft(), 400)
    return () => window.clearTimeout(timeout)
  }, [editRevision, persistDraft])

  React.useEffect(() => {
    const flushOnPageHide = () => {
      if (hasUnstoredChanges()) persistDraft(false)
    }
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') flushOnPageHide()
    }

    window.addEventListener('pagehide', flushOnPageHide)
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      window.removeEventListener('pagehide', flushOnPageHide)
      document.removeEventListener('visibilitychange', flushWhenHidden)
      flushOnPageHide()
    }
  }, [hasUnstoredChanges, persistDraft])

  function markEdited() {
    const revision = editRevisionRef.current + 1
    editRevisionRef.current = revision
    setEditRevision(revision)
    setLocalSaveState('saving')
  }

  function updateTitle(value: string) {
    titleRef.current = value
    setTitle(value)
    markEdited()
  }

  function updateDescription(value: string) {
    descriptionRef.current = value
    setDescription(value)
    markEdited()
  }

  function updateWorkspace(workspace: ExampleWorkspace) {
    workspaceRef.current = workspace
    markEdited()
  }

  async function save() {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    persistDraft()

    try {
      const record = await createNotebookRecord(currentProject())
      promotedRef.current = true
      clearNotebookDraft(draftStorage)
      try {
        await navigate({
          to: '/notebook/$id',
          params: { id: record.id },
        })
      } catch {
        window.location.assign(`/notebook/${record.id}`)
      }
    } catch (cause) {
      savingRef.current = false
      setSaving(false)
      setSaveError(formatError(cause))
    }
  }

  function saveAfterAuthentication() {
    persistDraft()
    if (user) {
      void save()
      return
    }

    openLoginModal({
      description: 'Sign in to save this notebook and create a shareable link.',
      onSuccess: () => void save(),
    })
  }

  const status =
    localSaveState === 'error'
      ? 'Local save failed'
      : localSaveState === 'saving'
        ? 'Saving locally'
        : 'Local draft'

  return (
    <main className="flex h-[calc(100dvh-var(--navbar-height))] min-h-0 flex-col overflow-hidden bg-background-default text-text-primary">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border-default bg-background-default px-2 sm:gap-3 sm:px-4">
        <Button
          as={Link}
          to="/notebook"
          variant="icon"
          color="gray"
          size="icon-sm"
          aria-label="Back to notebooks"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
        </Button>

        <div className="min-w-0 flex-1">
          <input
            aria-label="Notebook title"
            value={title}
            maxLength={160}
            disabled={saving}
            onChange={(event) => updateTitle(event.target.value)}
            onBlur={() => {
              if (!title.trim()) updateTitle('Untitled notebook')
            }}
            className="block w-full truncate rounded-sm bg-transparent text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          />
          <input
            aria-label="Notebook description"
            value={description}
            maxLength={1_000}
            disabled={saving}
            placeholder="Add a description"
            onChange={(event) => updateDescription(event.target.value)}
            className="block w-full truncate rounded-sm bg-transparent text-xs text-text-muted outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-border-focus"
          />
        </div>

        <span
          className={`shrink-0 text-[10px] sm:text-xs ${localSaveState === 'error' ? 'text-text-error' : 'text-text-muted'}`}
          role="status"
        >
          {status}
        </span>

        <Button
          type="button"
          size="xs"
          disabled={saving || userQuery.isPending}
          aria-label={user ? 'Save notebook' : 'Sign in to save notebook'}
          onClick={saveAfterAuthentication}
        >
          {saving ? (
            <SpinnerGapIcon
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <FloppyDiskIcon className="size-3.5" aria-hidden="true" />
          )}
          <span className="sm:hidden">Save</span>
          <span className="hidden sm:inline">
            {user ? 'Save online' : 'Sign in to save'}
          </span>
        </Button>
      </header>

      {saveError || localError ? (
        <div
          className="shrink-0 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-text-error"
          role="alert"
        >
          {saveError || localError}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1" inert={saving}>
        <ExampleWorkbench
          autoRun={false}
          definition={definition}
          fullscreen
          filesInitiallyOpen
          runLabel="Run notebook"
          onWorkspaceChange={updateWorkspace}
        />
      </div>
    </main>
  )
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
