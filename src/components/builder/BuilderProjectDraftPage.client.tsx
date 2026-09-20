import * as React from 'react'
import {
  ArrowLeftIcon,
  FloppyDiskIcon,
  SpinnerGapIcon,
} from '@phosphor-icons/react'
import { Link, useBlocker, useNavigate } from '@tanstack/react-router'
import { Button } from '~/components/ds/ui'
import {
  ExampleWorkbench,
  type ExampleWorkbenchHandle,
  type ExampleWorkbenchRunResult,
  type ExampleWorkbenchRunRequest,
} from '~/components/examples/ExampleWorkbench.client'
import {
  BuilderAssistant,
  type BuilderAssistantHandle,
} from '~/components/builder/BuilderAssistant.client'
import { BuilderProjectDraftSkeleton } from '~/components/builder/BuilderLoading'
import { useLoginModal } from '~/contexts/LoginModalContext'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { createEmptyExampleEnvironmentSnapshot } from '~/utils/example-run-observation'
import {
  createSharedExampleProject,
  sharedProjectToExampleDefinition,
} from '~/utils/example-project'
import type { ExampleWorkspace } from '~/utils/example-workspace'
import type { BuilderAiExecution } from '~/utils/builder-ai'
import {
  getBuilderAiHiddenFiles,
  requiresBuilderWorkbenchReset,
} from '~/utils/builder-ai-execution'
import { shouldAutoRunBuilder } from '~/utils/builder-auto-run.client'
import {
  blankBuilderProject,
  clearBuilderProjectDraft,
  createBuilderProjectDraftId,
  createBuilderProjectFromTemplateId,
  getBrowserBuilderProjectDraftStorage,
  loadBuilderProjectDraft,
  saveBuilderProjectDraft,
} from '~/utils/builder-project-draft'
import { createBuilderProject } from '~/utils/builder-project.client'
import { isBuilderProjectId } from '~/utils/builder-project'
import {
  getBuilderProjectDraftPromotionIds,
  promoteBuilderProjectTranscript,
} from '~/utils/builder-project-transcript-import.client'

type LocalSaveState = 'error' | 'saved' | 'saving'

export function BuilderProjectDraftPage({ template }: { template?: string }) {
  const navigate = useNavigate()
  const { openLoginModal } = useLoginModal()
  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const [draftStorage] = React.useState(getBrowserBuilderProjectDraftStorage)
  const [initialDraft] = React.useState(() => {
    const templateProject = template
      ? createBuilderProjectFromTemplateId(template)
      : undefined
    const storedDraft = loadBuilderProjectDraft(draftStorage)

    if (storedDraft) {
      return {
        id: isBuilderProjectId(storedDraft.id)
          ? storedDraft.id
          : createBuilderProjectDraftId(),
        project: storedDraft.project,
        needsInitialSave: false,
      }
    }

    if (templateProject) {
      return {
        id: createBuilderProjectDraftId(),
        project: templateProject,
        needsInitialSave: true,
      }
    }

    return {
      id: createBuilderProjectDraftId(),
      project: blankBuilderProject,
      needsInitialSave: true,
    }
  })
  const draftId = initialDraft.id
  const initialProject = initialDraft.project
  const [project, setProject] = React.useState(initialProject)
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
  const [promotionPending, setPromotionPending] = React.useState(false)
  const [activeView, setActiveView] = React.useState<'chat' | 'code'>('chat')
  const [aiTransactionActive, setAiTransactionActive] = React.useState(false)
  const [assistantRunning, setAssistantRunning] = React.useState(false)
  const [runRequest, setRunRequest] =
    React.useState<ExampleWorkbenchRunRequest>()
  const assistantRef = React.useRef<BuilderAssistantHandle>(null)
  const workbenchRef = React.useRef<ExampleWorkbenchHandle>(null)
  const projectRef = React.useRef(initialProject)
  const workspaceRef = React.useRef<ExampleWorkspace>(initialProject.workspace)
  const titleRef = React.useRef(initialProject.title)
  const descriptionRef = React.useRef(initialProject.description)
  const editRevisionRef = React.useRef(0)
  const persistedRevisionRef = React.useRef(0)
  const promotedRef = React.useRef(false)
  const savingRef = React.useRef(false)
  const draftStoredRef = React.useRef(!initialDraft.needsInitialSave)
  const aiTransactionActiveRef = React.useRef(false)
  const promotionIds = React.useMemo(
    () => getBuilderProjectDraftPromotionIds(draftId),
    [draftId],
  )

  const definition = React.useMemo(
    () => sharedProjectToExampleDefinition('local-draft', project),
    [project],
  )

  const currentProject = React.useCallback(() => {
    const current = projectRef.current
    return createSharedExampleProject({
      title: titleRef.current.trim() || 'Untitled project',
      description: descriptionRef.current.trim(),
      initialFile: current.initialFile,
      hiddenFiles: current.hiddenFiles,
      runtime: current.runtime,
      workspace: workspaceRef.current,
    })
  }, [])

  const persistDraft = React.useCallback(
    (updateUi = true, allowAiTransaction = false) => {
      if (promotedRef.current) return true
      if (aiTransactionActiveRef.current && !allowAiTransaction) return true
      const revision = editRevisionRef.current
      const saved = saveBuilderProjectDraft(draftStorage, {
        id: draftId,
        project: currentProject(),
      })
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
    [currentProject, draftId, draftStorage],
  )

  const hasUnstoredChanges = React.useCallback(
    () =>
      !promotedRef.current &&
      (aiTransactionActiveRef.current ||
        !draftStoredRef.current ||
        editRevisionRef.current > persistedRevisionRef.current),
    [],
  )

  const shouldBlockBeforeUnload = React.useCallback(
    () =>
      aiTransactionActiveRef.current ||
      (hasUnstoredChanges() && !persistDraft(false)),
    [hasUnstoredChanges, persistDraft],
  )

  useBlocker({
    disabled: false,
    enableBeforeUnload: shouldBlockBeforeUnload,
    shouldBlockFn: () => {
      if (aiTransactionActiveRef.current) return true
      if (!hasUnstoredChanges()) return false
      return !persistDraft()
    },
  })

  React.useEffect(() => {
    document.title = `${title || 'Untitled project'} | TanStack`
  }, [title])

  React.useEffect(() => {
    if (!template) return
    void navigate({
      to: '/builder/new',
      search: {},
      replace: true,
    })
  }, [navigate, template])

  React.useEffect(() => {
    if (initialDraft.needsInitialSave) persistDraft()
  }, [initialDraft.needsInitialSave, persistDraft])

  React.useEffect(() => {
    if (aiTransactionActive || editRevision <= persistedRevisionRef.current) {
      return
    }
    const timeout = window.setTimeout(() => persistDraft(), 400)
    return () => window.clearTimeout(timeout)
  }, [aiTransactionActive, editRevision, persistDraft])

  React.useEffect(() => {
    const flushOnPageHide = () => {
      if (aiTransactionActiveRef.current) return
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

  function applyAiExecution(
    execution: BuilderAiExecution,
    signal: AbortSignal,
  ) {
    const currentProject = projectRef.current
    const currentWorkspace = workspaceRef.current
    if (signal.aborted) {
      return Promise.resolve({
        ok: false as const,
        phase: 'superseded' as const,
        message: 'The builder edit was stopped.',
        snapshot: createEmptyExampleEnvironmentSnapshot({
          runId: crypto.randomUUID(),
          runtime:
            execution.runtime?.type === 'webcontainer'
              ? 'webcontainer'
              : 'client',
        }),
      })
    }

    const nextProject = createSharedExampleProject({
      title: titleRef.current.trim() || 'Untitled project',
      description: descriptionRef.current.trim(),
      initialFile: currentProject.initialFile,
      hiddenFiles: getBuilderAiHiddenFiles(
        currentProject.hiddenFiles,
        execution.workspace,
      ),
      runtime: execution.runtime ?? undefined,
      workspace: execution.workspace,
    })
    projectRef.current = nextProject
    workspaceRef.current = execution.workspace

    if (
      !requiresBuilderWorkbenchReset(
        currentProject.runtime ?? null,
        currentWorkspace,
        execution,
      ) &&
      workbenchRef.current
    ) {
      return workbenchRef.current.replaceWorkspaceAndRun(
        execution.workspace,
        signal,
        { notify: false },
      )
    }

    setProject(nextProject)
    return new Promise<ExampleWorkbenchRunResult>((resolve) => {
      const id = crypto.randomUUID()
      setRunRequest({
        id,
        signal,
        onComplete(result) {
          setRunRequest((current) => (current?.id === id ? undefined : current))
          resolve(result)
        },
      })
    })
  }

  async function prepareAiExecution() {
    persistDraft()
    aiTransactionActiveRef.current = true
    setAiTransactionActive(true)
    const current = projectRef.current
    return {
      runtime: current.runtime ?? null,
      workspace: workspaceRef.current,
    }
  }

  function commitAiExecution(execution: BuilderAiExecution) {
    const current = projectRef.current
    const nextProject = createSharedExampleProject({
      title: titleRef.current.trim() || 'Untitled project',
      description: descriptionRef.current.trim(),
      initialFile: current.initialFile,
      hiddenFiles: getBuilderAiHiddenFiles(
        current.hiddenFiles,
        execution.workspace,
      ),
      runtime: execution.runtime ?? undefined,
      workspace: execution.workspace,
    })
    projectRef.current = nextProject
    workspaceRef.current = execution.workspace
    markEdited()
    if (!persistDraft(true, true)) {
      throw new Error(
        'This browser could not store the validated builder edit.',
      )
    }
  }

  function finishAiExecution() {
    aiTransactionActiveRef.current = false
    setAiTransactionActive(false)
  }

  async function restoreAiExecution(
    execution: BuilderAiExecution,
    reason: 'manual' | 'rollback',
  ) {
    await applyAiExecution(execution, new AbortController().signal)
    if (reason === 'manual') markEdited()
  }

  async function save() {
    if (savingRef.current || aiTransactionActiveRef.current) return
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    persistDraft()

    try {
      const project = await createBuilderProject(currentProject(), {
        clientMutationId: draftId,
        id: draftId,
        revisionId: promotionIds.revisionId,
      })
      setPromotionPending(true)
      await promoteBuilderProjectTranscript({
        projectId: project.id,
        scope: `local-draft:${draftId}`,
        clientMutationId: promotionIds.transcriptImportMutationId,
      })
      promotedRef.current = true
      clearBuilderProjectDraft(draftStorage)
      try {
        await navigate({
          to: '/builder/$id',
          params: { id: project.id },
        })
      } catch {
        window.location.assign(`/builder/${project.id}`)
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
      description: 'Sign in to save this project and create a shareable link.',
      onSuccess: () => void save(),
    })
  }

  const status =
    localSaveState === 'error'
      ? 'Local save failed'
      : localSaveState === 'saving'
        ? 'Saving locally'
        : 'Local draft'

  if (userQuery.isPending) return <BuilderProjectDraftSkeleton />

  return (
    <main className="fixed inset-x-0 top-[var(--navbar-height)] bottom-0 z-20 flex min-h-0 flex-col overflow-hidden bg-background-default text-text-primary">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border-subtle bg-background-default px-2 sm:gap-3 sm:px-4">
        <Button
          as={Link}
          to="/builder"
          variant="icon"
          color="gray"
          size="icon-sm"
          aria-label="Back to Builder"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
        </Button>

        <div className="min-w-0 flex-1">
          <input
            aria-label="Builder title"
            value={title}
            maxLength={160}
            disabled={saving || promotionPending}
            onChange={(event) => updateTitle(event.target.value)}
            onBlur={() => {
              if (!title.trim()) updateTitle('Untitled project')
            }}
            className="block w-full truncate rounded-sm bg-transparent text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          />
          <input
            aria-label="Builder description"
            value={description}
            maxLength={1_000}
            disabled={saving || promotionPending}
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
          disabled={saving || aiTransactionActive || userQuery.isPending}
          aria-label={user ? 'Save builder' : 'Sign in to save builder'}
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

      <div className="flex min-h-0 flex-1" inert={saving || promotionPending}>
        <ExampleWorkbench
          alternateEditor={{
            active: activeView === 'chat',
            label: 'Chat',
            onActiveChange: (active) => setActiveView(active ? 'chat' : 'code'),
            submitPrompt: (content, lifecycle) =>
              assistantRef.current?.submitPrompt(content, lifecycle) ?? false,
            content: (
              <BuilderAssistant
                ref={assistantRef}
                credentialScope={user?.userId ?? 'anonymous'}
                enabled
                getExecution={() => ({
                  runtime: projectRef.current.runtime ?? null,
                  workspace: workspaceRef.current,
                })}
                hiddenFiles={project.hiddenFiles ?? []}
                onApply={applyAiExecution}
                onCommit={commitAiExecution}
                onDismiss={() => setActiveView('code')}
                onFinish={finishAiExecution}
                onPrepare={prepareAiExecution}
                onRestore={restoreAiExecution}
                onRunningChange={setAssistantRunning}
                storageScope={`local-draft:${draftId}`}
              />
            ),
          }}
          autoRun={shouldAutoRunBuilder(window.navigator)}
          className="w-full"
          definition={definition}
          fullscreen
          filesInitiallyOpen
          runDisabled={assistantRunning}
          runLabel="Run builder"
          runRequest={runRequest}
          workbenchRef={workbenchRef}
          onWorkspaceChange={updateWorkspace}
        />
      </div>
    </main>
  )
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
