import * as React from 'react'
import {
  ArrowLeftIcon,
  CheckIcon,
  CopyIcon,
  FlagIcon,
  GitForkIcon,
  SpinnerGapIcon,
} from '@phosphor-icons/react'
import { Link, useBlocker, useNavigate } from '@tanstack/react-router'
import { ButtonGroup } from '~/components/ButtonGroup'
import { Button } from '~/components/ds/ui'
import {
  ExampleWorkbench,
  type ExampleWorkbenchHandle,
  type ExampleWorkbenchRunResult,
  type ExampleWorkbenchRunRequest,
} from '~/components/examples/ExampleWorkbench.client'
import { createEmptyExampleEnvironmentSnapshot } from '~/utils/example-run-observation'
import { NotebookAssistant } from '~/components/notebook/NotebookAssistant.client'
import { NotebookEditorSkeleton } from '~/components/notebook/NotebookLoading'
import { useLoginModal } from '~/contexts/LoginModalContext'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { copyTextToClipboard } from '~/utils/browser-effects'
import {
  createSharedExampleProject,
  sharedProjectToExampleDefinition,
  type SharedExampleProject,
} from '~/utils/example-project'
import type { ExampleWorkspace } from '~/utils/example-workspace'
import type { NotebookAiExecution } from '~/utils/notebook-ai'
import { shouldAutoRunNotebook } from '~/utils/notebook-auto-run.client'
import {
  createNotebookRecord,
  getNotebookRecord,
  getNotebookRecordProject,
  NotebookRequestError,
  updateNotebookRecord,
} from '~/utils/notebook-record.client'
import type { NotebookRecord } from '~/utils/notebook-record'

type SaveState = 'error' | 'saved' | 'saving' | 'unsaved'

export function NotebookPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const { openLoginModal } = useLoginModal()
  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const [record, setRecord] = React.useState<NotebookRecord>()
  const [project, setProject] = React.useState<SharedExampleProject>()
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [loadError, setLoadError] = React.useState('')
  const [saveError, setSaveError] = React.useState('')
  const [saveConflict, setSaveConflict] = React.useState(false)
  const [saveState, setSaveState] = React.useState<SaveState>('saved')
  const [editRevision, setEditRevision] = React.useState(0)
  const [hasLocalChanges, setHasLocalChanges] = React.useState(false)
  const [forking, setForking] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [activeView, setActiveView] = React.useState<'chat' | 'code'>('code')
  const [aiTransactionActive, setAiTransactionActive] = React.useState(false)
  const [assistantRunning, setAssistantRunning] = React.useState(false)
  const [runRequest, setRunRequest] =
    React.useState<ExampleWorkbenchRunRequest>()
  const workbenchRef = React.useRef<ExampleWorkbenchHandle>(null)
  const workspaceRef = React.useRef<ExampleWorkspace | undefined>(undefined)
  const recordRef = React.useRef<NotebookRecord | undefined>(undefined)
  const projectRef = React.useRef<SharedExampleProject | undefined>(undefined)
  const titleRef = React.useRef('')
  const descriptionRef = React.useRef('')
  const isOwnerRef = React.useRef(false)
  const editRevisionRef = React.useRef(0)
  const savedRevisionRef = React.useRef(0)
  const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve())
  const aiTransactionActiveRef = React.useRef(false)
  const copiedTimeoutRef = React.useRef<number | undefined>(undefined)
  const isOwner = Boolean(user && record && user.userId === record.ownerId)

  recordRef.current = record
  titleRef.current = title
  descriptionRef.current = description
  isOwnerRef.current = isOwner

  const flushPendingSave = React.useCallback(
    (options?: { allowAiTransaction?: boolean }) => {
      if (
        aiTransactionActiveRef.current &&
        options?.allowAiTransaction !== true
      ) {
        return Promise.reject(
          new Error('The notebook is still validating an assistant edit.'),
        )
      }

      const queuedSave = saveQueueRef.current
        .catch(() => {})
        .then(async () => {
          while (
            isOwnerRef.current &&
            editRevisionRef.current > savedRevisionRef.current
          ) {
            const currentRecord = recordRef.current
            const currentProject = projectRef.current
            const workspace = workspaceRef.current
            if (!currentRecord || !currentProject || !workspace) return

            const revision = editRevisionRef.current
            setSaveState('saving')
            setSaveError('')
            setSaveConflict(false)

            const nextProject = createSharedExampleProject({
              title: titleRef.current.trim() || 'Untitled notebook',
              description: descriptionRef.current.trim(),
              initialFile: currentProject.initialFile,
              hiddenFiles: currentProject.hiddenFiles,
              runtime: currentProject.runtime,
              workspace,
            })

            try {
              const nextRecord = await updateNotebookRecord(
                currentRecord,
                nextProject,
              )
              recordRef.current = nextRecord
              savedRevisionRef.current = revision
              setRecord(nextRecord)
              setSaveState(
                editRevisionRef.current === revision ? 'saved' : 'saving',
              )
            } catch (cause) {
              const conflict =
                cause instanceof NotebookRequestError && cause.status === 409
              setSaveState('error')
              setSaveConflict(conflict)
              setSaveError(
                conflict
                  ? 'This notebook changed in another tab. Save this version as a fork.'
                  : formatError(cause),
              )
              throw cause
            }
          }
        })

      saveQueueRef.current = queuedSave
      return queuedSave
    },
    [],
  )

  const hasPendingSave = React.useCallback(
    () =>
      aiTransactionActiveRef.current ||
      (isOwnerRef.current &&
        editRevisionRef.current > savedRevisionRef.current),
    [],
  )

  useBlocker({
    disabled: !isOwner,
    enableBeforeUnload: hasPendingSave,
    shouldBlockFn: async () => {
      if (aiTransactionActiveRef.current) return true
      try {
        await flushPendingSave()
        return false
      } catch {
        return true
      }
    },
  })

  React.useEffect(() => {
    let active = true
    setLoadError('')

    void getNotebookRecord(id)
      .then(async (nextRecord) => ({
        project: await getNotebookRecordProject(nextRecord),
        record: nextRecord,
      }))
      .then((result) => {
        if (!active) return
        setRecord(result.record)
        setProject(result.project)
        setTitle(result.record.title)
        setDescription(result.record.description)
        recordRef.current = result.record
        projectRef.current = result.project
        titleRef.current = result.record.title
        descriptionRef.current = result.record.description
        workspaceRef.current = result.project.workspace
        editRevisionRef.current = 0
        savedRevisionRef.current = 0
        setEditRevision(0)
        setSaveState('saved')
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(formatError(cause))
      })

    return () => {
      active = false
    }
  }, [id])

  React.useEffect(() => {
    if (!record) return
    document.title = `${title || record.title} | TanStack`
  }, [record, title])

  React.useEffect(
    () => () => {
      if (copiedTimeoutRef.current !== undefined) {
        window.clearTimeout(copiedTimeoutRef.current)
      }
    },
    [],
  )

  React.useEffect(() => {
    if (
      aiTransactionActive ||
      !isOwner ||
      editRevision <= savedRevisionRef.current
    ) {
      return
    }

    const timeout = window.setTimeout(() => {
      void flushPendingSave().catch(() => {})
    }, 1_500)

    return () => window.clearTimeout(timeout)
  }, [aiTransactionActive, editRevision, flushPendingSave, isOwner])

  const definition = React.useMemo(
    () => (project ? sharedProjectToExampleDefinition(id, project) : undefined),
    [id, project],
  )

  function markEdited() {
    const revision = editRevisionRef.current + 1
    editRevisionRef.current = revision
    setEditRevision(revision)
    setSaveState('unsaved')
  }

  function updateWorkspace(workspace: ExampleWorkspace) {
    workspaceRef.current = workspace
    setHasLocalChanges(true)
    if (isOwner) markEdited()
  }

  function applyAiExecution(
    execution: NotebookAiExecution,
    signal: AbortSignal,
  ) {
    const currentProject = projectRef.current
    const currentWorkspace = workspaceRef.current
    if (!currentProject || !currentWorkspace || signal.aborted) {
      return Promise.resolve({
        ok: false as const,
        phase: 'superseded' as const,
        message: 'The notebook editor is no longer available.',
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
      title: titleRef.current.trim() || 'Untitled notebook',
      description: descriptionRef.current.trim(),
      initialFile: currentProject.initialFile,
      hiddenFiles: getAiHiddenFiles(
        currentProject.hiddenFiles,
        execution.workspace,
      ),
      runtime: execution.runtime ?? undefined,
      workspace: execution.workspace,
    })
    projectRef.current = nextProject
    workspaceRef.current = execution.workspace
    const resetWorkbench = requiresWorkbenchReset(
      currentProject.runtime ?? null,
      currentWorkspace,
      execution,
    )
    if (!resetWorkbench && workbenchRef.current) {
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
    await flushPendingSave()
    const currentProject = projectRef.current
    const currentWorkspace = workspaceRef.current
    if (!currentProject || !currentWorkspace) {
      throw new Error('The notebook editor is no longer available.')
    }
    aiTransactionActiveRef.current = true
    setAiTransactionActive(true)
    return {
      runtime: currentProject.runtime ?? null,
      workspace: currentWorkspace,
    }
  }

  async function commitAiExecution(execution: NotebookAiExecution) {
    const currentProject = projectRef.current
    if (!currentProject) {
      throw new Error('The notebook editor is no longer available.')
    }
    projectRef.current = createSharedExampleProject({
      title: titleRef.current.trim() || 'Untitled notebook',
      description: descriptionRef.current.trim(),
      initialFile: currentProject.initialFile,
      hiddenFiles: getAiHiddenFiles(
        currentProject.hiddenFiles,
        execution.workspace,
      ),
      runtime: execution.runtime ?? undefined,
      workspace: execution.workspace,
    })
    workspaceRef.current = execution.workspace
    setHasLocalChanges(true)
    if (!isOwner) return
    markEdited()
    await flushPendingSave({ allowAiTransaction: true })
  }

  function finishAiExecution() {
    aiTransactionActiveRef.current = false
    setAiTransactionActive(false)
  }

  async function restoreAiExecution(
    execution: NotebookAiExecution,
    reason: 'manual' | 'rollback',
  ) {
    const currentProject = projectRef.current
    const currentWorkspace = workspaceRef.current
    if (!currentProject || !currentWorkspace) {
      throw new Error('The notebook editor is no longer available.')
    }

    if (reason === 'manual') {
      setHasLocalChanges(true)
      if (isOwner) markEdited()
    }
    await applyAiExecution(execution, new AbortController().signal)
  }

  function updateTitle(value: string) {
    setTitle(value)
    markEdited()
  }

  function updateDescription(value: string) {
    setDescription(value)
    markEdited()
  }

  async function fork() {
    if (!record || !project || !workspaceRef.current) return
    const resolvingConflict = saveConflict
    setForking(true)
    if (!resolvingConflict) setSaveError('')

    try {
      const nextRecord = await createNotebookRecord(
        createSharedExampleProject({
          title: titleRef.current.trim() || 'Untitled notebook',
          description: descriptionRef.current.trim(),
          initialFile: project.initialFile,
          hiddenFiles: project.hiddenFiles,
          runtime: project.runtime,
          workspace: workspaceRef.current,
        }),
        record.id,
      )
      savedRevisionRef.current = editRevisionRef.current
      setSaveState('saved')
      await navigate({
        to: '/notebook/$id',
        params: { id: nextRecord.id },
      })
    } catch (cause) {
      setSaveConflict(resolvingConflict)
      setSaveError(
        resolvingConflict
          ? `${formatError(cause)} Try saving as a fork again.`
          : formatError(cause),
      )
      setForking(false)
    }
  }

  function forkAfterAuthentication() {
    if (user) {
      void fork()
      return
    }

    openLoginModal({ onSuccess: () => void fork() })
  }

  async function share() {
    try {
      if (isOwner) await flushPendingSave()
      await copyTextToClipboard(window.location.href)
      setCopied(true)
      if (copiedTimeoutRef.current !== undefined) {
        window.clearTimeout(copiedTimeoutRef.current)
      }
      copiedTimeoutRef.current = window.setTimeout(() => {
        setCopied(false)
        copiedTimeoutRef.current = undefined
      }, 1_500)
    } catch (cause) {
      setSaveError(formatError(cause))
    }
  }

  if (loadError) {
    return (
      <main className="min-h-[calc(100dvh-var(--navbar-height))] bg-background-default px-5 py-16 text-text-primary">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-semibold">Notebook unavailable</h1>
          <p className="mt-2 text-sm text-text-muted">{loadError}</p>
          <Button
            as={Link}
            to="/notebook"
            variant="ghost"
            size="sm"
            className="mt-6"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Notebooks
          </Button>
        </div>
      </main>
    )
  }

  if (!record || !project || !definition || userQuery.isPending) {
    return <NotebookEditorSkeleton />
  }

  const authorName = record.author.name || 'TanStack user'
  const parentId = record.forkedFromId
  const shareLabel =
    hasLocalChanges && !isOwner ? 'Copy original notebook link' : 'Copy link'

  return (
    <main className="fixed inset-x-0 top-[var(--navbar-height)] bottom-0 z-20 flex min-h-0 flex-col overflow-hidden bg-background-default text-text-primary">
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
          {isOwner ? (
            <>
              <input
                aria-label="Notebook title"
                value={title}
                maxLength={160}
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
                placeholder="Add a description"
                onChange={(event) => updateDescription(event.target.value)}
                className="block w-full truncate rounded-sm bg-transparent text-xs text-text-muted outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-border-focus"
              />
            </>
          ) : (
            <>
              <h1 className="truncate text-sm font-semibold">{record.title}</h1>
              <div className="flex items-center gap-1.5 truncate text-xs text-text-muted">
                {record.author.image ? (
                  <img
                    src={record.author.image}
                    alt=""
                    className="size-4 rounded-full"
                  />
                ) : null}
                <span className="truncate">{authorName}</span>
                <span className="hidden sm:inline">
                  · Updated {formatDate(record.updatedAt)}
                </span>
                {hasLocalChanges ? (
                  <span className="shrink-0">· Edited locally</span>
                ) : null}
              </div>
            </>
          )}
        </div>

        {isOwner ? (
          <span
            className={`shrink-0 text-[10px] sm:text-xs ${saveState === 'error' ? 'text-text-error' : 'text-text-muted'}`}
            role="status"
          >
            <span className="hidden sm:inline">Unlisted · </span>
            {saveState === 'error'
              ? 'Save failed'
              : saveState === 'saving'
                ? 'Saving'
                : saveState === 'unsaved'
                  ? 'Unsaved'
                  : 'Saved'}
          </span>
        ) : null}

        <ButtonGroup>
          {parentId ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              rounded="none"
              aria-label="Open the notebook this was forked from"
              onClick={() =>
                void navigate({
                  to: '/notebook/$id',
                  params: { id: parentId },
                })
              }
            >
              <GitForkIcon className="size-3.5" aria-hidden="true" />
              <span className="hidden md:inline">Parent</span>
            </Button>
          ) : null}
          {!isOwner ? (
            <Button
              as="a"
              href={`mailto:support@tanstack.com?subject=${encodeURIComponent(`Report notebook ${record.id}`)}&body=${encodeURIComponent(window.location.href)}`}
              variant="ghost"
              size="xs"
              rounded="none"
              aria-label="Report notebook"
            >
              <FlagIcon className="size-3.5" aria-hidden="true" />
              <span className="hidden lg:inline">Report</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            rounded="none"
            aria-label={copied ? 'Notebook link copied' : shareLabel}
            onClick={() => void share()}
          >
            {copied ? (
              <CheckIcon className="size-3.5" aria-hidden="true" />
            ) : (
              <CopyIcon className="size-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {copied
                ? 'Copied'
                : hasLocalChanges && !isOwner
                  ? 'Original link'
                  : 'Share'}
            </span>
          </Button>
          {!isOwner ? (
            <Button
              type="button"
              variant="primary"
              size="xs"
              rounded="none"
              disabled={forking}
              aria-label={
                hasLocalChanges ? 'Fork to save local changes' : 'Fork notebook'
              }
              onClick={forkAfterAuthentication}
            >
              {forking ? (
                <SpinnerGapIcon
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <GitForkIcon className="size-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {hasLocalChanges ? 'Fork to save' : 'Fork'}
              </span>
            </Button>
          ) : null}
        </ButtonGroup>
      </header>

      {saveError ? (
        <div
          className="flex shrink-0 items-center justify-between gap-4 border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-text-error"
          role="alert"
        >
          <span className="min-w-0 truncate">{saveError}</span>
          {isOwner && saveConflict ? (
            <button
              type="button"
              className="flex shrink-0 items-center gap-1.5 font-medium underline-offset-2 hover:underline"
              disabled={forking}
              onClick={() => void fork()}
            >
              {forking ? (
                <SpinnerGapIcon
                  className="size-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : null}
              Save as fork
            </button>
          ) : isOwner && saveState === 'error' ? (
            <button
              type="button"
              className="shrink-0 font-medium underline-offset-2 hover:underline"
              onClick={() => void flushPendingSave().catch(() => {})}
            >
              Retry save
            </button>
          ) : null}
        </div>
      ) : null}

      {!isOwner && record.description ? (
        <p
          className="shrink-0 truncate border-b border-border-default px-4 py-2 text-xs text-text-muted"
          title={record.description}
        >
          {record.description}
        </p>
      ) : null}

      {hasLocalChanges && !isOwner ? (
        <div
          className="shrink-0 border-b border-border-default bg-background-subtle px-4 py-2 text-xs text-text-muted"
          role="status"
        >
          Changes are only in this browser. Fork to save.
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <ExampleWorkbench
          alternateEditor={{
            active: activeView === 'chat',
            label: 'Chat',
            onActiveChange: (active) => setActiveView(active ? 'chat' : 'code'),
            content: (
              <NotebookAssistant
                key={`${record.id}:${user?.userId ?? 'anonymous'}`}
                authenticated={Boolean(user)}
                credentialScope={user?.userId}
                enabled={activeView === 'chat'}
                getExecution={() => {
                  return {
                    runtime: projectRef.current?.runtime ?? null,
                    workspace: workspaceRef.current ?? project.workspace,
                  }
                }}
                hiddenFiles={project.hiddenFiles ?? []}
                onApply={applyAiExecution}
                onCommit={commitAiExecution}
                onFinish={finishAiExecution}
                onPrepare={prepareAiExecution}
                onRestore={restoreAiExecution}
                onRunningChange={setAssistantRunning}
                onSignIn={() => openLoginModal()}
                storageScope={user ? `${user.userId}:${record.id}` : undefined}
              />
            ),
          }}
          autoRun={shouldAutoRunNotebook(window.navigator)}
          className="w-full"
          definition={definition}
          fullscreen
          filesInitiallyOpen
          runDisabled={assistantRunning}
          runLabel="Run notebook"
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(value),
  )
}

function requiresWorkbenchReset(
  currentRuntime: NotebookAiExecution['runtime'],
  currentWorkspace: ExampleWorkspace,
  next: NotebookAiExecution,
) {
  if (JSON.stringify(currentRuntime) !== JSON.stringify(next.runtime)) {
    return true
  }
  if (!next.runtime) return false
  if (
    currentWorkspace.files['/package.json'] !==
    next.workspace.files['/package.json']
  ) {
    return true
  }

  return (
    hasDifferentPaths(currentWorkspace.files, next.workspace.files) ||
    hasDifferentPaths(
      currentWorkspace.binaryFiles ?? {},
      next.workspace.binaryFiles ?? {},
    )
  )
}

function hasDifferentPaths(
  current: Record<string, string>,
  next: Record<string, string>,
) {
  const currentPaths = Object.keys(current)
  const nextPaths = Object.keys(next)
  return (
    currentPaths.length !== nextPaths.length ||
    currentPaths.some((path) => next[path] === undefined)
  )
}

function getAiHiddenFiles(
  hiddenFiles: ReadonlyArray<string> | undefined,
  workspace: ExampleWorkspace,
) {
  return [
    ...new Set([
      ...(hiddenFiles ?? []),
      ...Object.keys(workspace.files).filter((path) =>
        path.startsWith('/.tanstack/'),
      ),
    ]),
  ]
}
