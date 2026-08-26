import * as React from 'react'
import { useLiveQuery } from '@tanstack/react-db'
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
import {
  BuilderAssistant,
  type BuilderAssistantHandle,
  type BuilderAssistantProjectSync,
  type BuilderAssistantRevisionCommit,
} from '~/components/builder/BuilderAssistant.client'
import { BuilderEditorSkeleton } from '~/components/builder/BuilderLoading'
import { useLoginModal } from '~/contexts/LoginModalContext'
import { useCurrentUserQuery } from '~/hooks/useCurrentUser'
import { copyTextToClipboard } from '~/utils/browser-effects'
import {
  createSharedExampleProject,
  sharedProjectToExampleDefinition,
  type SharedExampleProject,
} from '~/utils/example-project'
import type { ExampleWorkspace } from '~/utils/example-workspace'
import type { BuilderAiExecution } from '~/utils/builder-ai'
import { removeBuilderAiTranscriptScopeSnapshot } from '~/utils/builder-ai-persistence.client'
import {
  getBuilderAiHiddenFiles,
  requiresBuilderWorkbenchReset,
} from '~/utils/builder-ai-execution'
import { shouldAutoRunBuilder } from '~/utils/builder-auto-run.client'
import {
  createBuilderProject,
  getBuilderProject,
  getBuilderProjectSnapshot,
  storeBuilderProjectRevision,
} from '~/utils/builder-project.client'
import {
  settleBuilderProjectBootstrap,
  settleBuilderProjectRevisionHydration,
} from '~/utils/builder-project-bootstrap.client'
import type { BuilderProject } from '~/utils/builder-project'
import {
  createBuilderProjectSyncClient,
  type BuilderProjectSyncClient,
  type BuilderProjectSyncRow,
} from '~/utils/builder-project-sync.client'
import {
  getBuilderProjectTranscriptImportMutationId,
  importBuilderProjectTranscriptCommands,
  prepareBuilderProjectForkTranscriptImport,
  promoteBuilderProjectTranscript,
} from '~/utils/builder-project-transcript-import.client'
import type { BuilderProjectSyncProject } from '~/utils/builder-project-sync'
import {
  BuilderProjectSyncCommandRejectedError,
  discardBuilderProjectSyncCommand,
} from '~/utils/builder-project-sync-outbox.client'
import {
  clearBuilderProjectWorkingCopy,
  reconcileBuilderProjectWorkingCopy,
  saveBuilderProjectWorkingCopy,
  type BuilderProjectWorkingCopy,
} from '~/utils/builder-project-working-copy.client'

type SaveState = 'error' | 'saved' | 'saving' | 'unsaved'

type BuilderProjectSaveMutation = {
  editRevision: number
  clientMutationId: string
  revisionId: string
  baseRevisionId: string
  expectedRevisionNumber: number
}

export function BuilderProjectPage({ id }: { id: string }) {
  const navigate = useNavigate()
  const { openLoginModal } = useLoginModal()
  const userQuery = useCurrentUserQuery()
  const user = userQuery.data
  const [builderProject, setBuilderProject] = React.useState<BuilderProject>()
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
  const [forkTranscriptLocked, setForkTranscriptLocked] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [activeView, setActiveView] = React.useState<'chat' | 'code'>('chat')
  const [aiTransactionActive, setAiTransactionActive] = React.useState(false)
  const [assistantRunning, setAssistantRunning] = React.useState(false)
  const [runRequest, setRunRequest] =
    React.useState<ExampleWorkbenchRunRequest>()
  const [projectSyncClient, setProjectSyncClient] =
    React.useState<BuilderProjectSyncClient>()
  const assistantRef = React.useRef<BuilderAssistantHandle>(null)
  const workbenchRef = React.useRef<ExampleWorkbenchHandle>(null)
  const workspaceRef = React.useRef<ExampleWorkspace | undefined>(undefined)
  const builderProjectRef = React.useRef<BuilderProject | undefined>(undefined)
  const projectRef = React.useRef<SharedExampleProject | undefined>(undefined)
  const titleRef = React.useRef('')
  const descriptionRef = React.useRef('')
  const isOwnerRef = React.useRef(false)
  const saveConflictRef = React.useRef(false)
  const editRevisionRef = React.useRef(0)
  const localWorkspaceVersionRef = React.useRef(0)
  const savedRevisionRef = React.useRef(0)
  const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve())
  const workingCopyQueueRef = React.useRef<Promise<void>>(Promise.resolve())
  const workingCopyUpdatedAtRef = React.useRef(0)
  const projectSyncClientRef = React.useRef<
    BuilderProjectSyncClient | undefined
  >(undefined)
  const saveMutationRef = React.useRef<BuilderProjectSaveMutation | undefined>(
    undefined,
  )
  const inFlightSaveMutationRef = React.useRef<
    BuilderProjectSaveMutation | undefined
  >(undefined)
  const conflictingWorkingCopyRef = React.useRef<
    BuilderProjectWorkingCopy | undefined
  >(undefined)
  const forkMutationRef = React.useRef<
    | {
        clientMutationId: string
        id: string
        revisionId: string
      }
    | undefined
  >(undefined)
  const forkSourceScopeRef = React.useRef<string | undefined>(undefined)
  const forkTranscriptRef = React.useRef<
    | (Awaited<ReturnType<typeof prepareBuilderProjectForkTranscriptImport>> & {
        projectId: string
        project: SharedExampleProject
      })
    | undefined
  >(undefined)
  const aiTransactionActiveRef = React.useRef(false)
  const copiedTimeoutRef = React.useRef<number | undefined>(undefined)
  const syncedRevisionRequestRef = React.useRef<string | undefined>(undefined)
  const pendingAiRevisionRef = React.useRef<
    | {
        editRevision: number
        id: string
        project: SharedExampleProject
        workingCopy: BuilderProjectWorkingCopy
      }
    | undefined
  >(undefined)
  const isOwner = Boolean(
    user && builderProject && user.userId === builderProject.ownerId,
  )

  builderProjectRef.current = builderProject
  titleRef.current = title
  descriptionRef.current = description
  isOwnerRef.current = isOwner
  saveConflictRef.current = saveConflict

  const createCurrentProjectSnapshot = React.useCallback(() => {
    const currentProject = projectRef.current
    const workspace = workspaceRef.current
    if (!currentProject || !workspace) return undefined
    return createSharedExampleProject({
      title: titleRef.current.trim() || 'Untitled project',
      description: descriptionRef.current.trim(),
      initialFile: currentProject.initialFile,
      hiddenFiles: currentProject.hiddenFiles,
      runtime: currentProject.runtime,
      workspace,
    })
  }, [])

  const getOrCreateSaveMutation = React.useCallback((editRevision: number) => {
    const existing = saveMutationRef.current
    if (existing && existing !== inFlightSaveMutationRef.current) {
      const next = { ...existing, editRevision }
      saveMutationRef.current = next
      return next
    }

    const currentBuilderProject = builderProjectRef.current
    const pendingBase = inFlightSaveMutationRef.current
    const baseRevisionId =
      pendingBase?.revisionId ?? currentBuilderProject?.currentRevisionId
    const expectedRevisionNumber =
      pendingBase !== undefined
        ? pendingBase.expectedRevisionNumber + 1
        : currentBuilderProject?.currentRevisionNumber
    if (!baseRevisionId || !expectedRevisionNumber) return undefined

    const next: BuilderProjectSaveMutation = {
      editRevision,
      clientMutationId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      baseRevisionId,
      expectedRevisionNumber,
    }
    saveMutationRef.current = next
    return next
  }, [])

  const persistWorkingCopy = React.useCallback(
    (editRevision: number) => {
      const nextProject = createCurrentProjectSnapshot()
      const saveMutation = getOrCreateSaveMutation(editRevision)
      if (!nextProject || !saveMutation) {
        return Promise.reject(
          new Error('The Builder project revision is unavailable.'),
        )
      }

      workingCopyUpdatedAtRef.current = Math.max(
        Date.now(),
        workingCopyUpdatedAtRef.current + 1,
      )
      const workingCopy: BuilderProjectWorkingCopy = {
        projectId: id,
        clientMutationId: saveMutation.clientMutationId,
        revisionId: saveMutation.revisionId,
        baseRevisionId: saveMutation.baseRevisionId,
        expectedRevisionNumber: saveMutation.expectedRevisionNumber,
        project: nextProject,
        updatedAt: workingCopyUpdatedAtRef.current,
      }
      const queued = workingCopyQueueRef.current
        .catch(() => {})
        .then(async () => {
          await saveBuilderProjectWorkingCopy(workingCopy)
        })
      workingCopyQueueRef.current = queued
      return queued.then(() => ({
        saveMutation,
        project: nextProject,
        workingCopy,
      }))
    },
    [createCurrentProjectSnapshot, getOrCreateSaveMutation, id],
  )

  const flushPendingSave = React.useCallback(
    (options?: { allowAiTransaction?: boolean }) => {
      if (saveConflictRef.current) {
        return Promise.reject(
          new Error(
            'Recovered changes conflict with the current project revision.',
          ),
        )
      }
      if (
        aiTransactionActiveRef.current &&
        options?.allowAiTransaction !== true
      ) {
        return Promise.reject(
          new Error('The builder is still validating an assistant edit.'),
        )
      }

      const queuedSave = saveQueueRef.current
        .catch(() => {})
        .then(async () => {
          while (
            isOwnerRef.current &&
            editRevisionRef.current > savedRevisionRef.current
          ) {
            const currentBuilderProject = builderProjectRef.current
            const syncClient = projectSyncClientRef.current
            if (!currentBuilderProject || !syncClient) return

            const revision = editRevisionRef.current
            setSaveState('saving')
            setSaveError('')
            setSaveConflict(false)

            let attemptedWorkingCopy: BuilderProjectWorkingCopy | undefined
            try {
              const {
                project: nextProject,
                saveMutation,
                workingCopy,
              } = await persistWorkingCopy(revision)
              attemptedWorkingCopy = workingCopy
              inFlightSaveMutationRef.current = saveMutation
              await syncClient.executeCommand({
                type: 'project.revise',
                clientMutationId: saveMutation.clientMutationId,
                revisionId: saveMutation.revisionId,
                expectedRevisionNumber: saveMutation.expectedRevisionNumber,
                project: nextProject,
              })
              const syncedProject = getBuilderProjectSyncProject(syncClient)
              if (
                !syncedProject ||
                syncedProject.currentRevisionId !== saveMutation.revisionId
              ) {
                throw new Error(
                  'The Builder project revision was not acknowledged.',
                )
              }
              const nextBuilderProject = mergeBuilderProjectSyncState(
                currentBuilderProject,
                syncedProject,
              )
              builderProjectRef.current = nextBuilderProject
              savedRevisionRef.current = revision
              setBuilderProject(nextBuilderProject)
              await clearBuilderProjectWorkingCopy({
                projectId: id,
                clientMutationId: saveMutation.clientMutationId,
                revisionId: saveMutation.revisionId,
              })
              if (
                saveMutationRef.current?.clientMutationId ===
                saveMutation.clientMutationId
              ) {
                saveMutationRef.current = undefined
              }
              conflictingWorkingCopyRef.current = undefined
              setSaveState(
                editRevisionRef.current === revision ? 'saved' : 'saving',
              )
            } catch (cause) {
              const conflict =
                cause instanceof BuilderProjectSyncCommandRejectedError &&
                cause.rejection.code === 'project-revision-conflict'
              if (conflict) {
                conflictingWorkingCopyRef.current = attemptedWorkingCopy
                saveConflictRef.current = true
              }
              setSaveState('error')
              setSaveConflict(conflict)
              setSaveError(
                conflict
                  ? 'This project changed in another tab. Save this version as a fork.'
                  : formatError(cause),
              )
              throw cause
            } finally {
              if (inFlightSaveMutationRef.current?.editRevision === revision) {
                inFlightSaveMutationRef.current = undefined
              }
            }
          }
        })

      saveQueueRef.current = queuedSave
      return queuedSave
    },
    [id, persistWorkingCopy],
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

    void getBuilderProject(id)
      .then(async (nextBuilderProject) => ({
        builderProject: nextBuilderProject,
        project: await getBuilderProjectSnapshot(nextBuilderProject),
      }))
      .then((result) => {
        if (!active) return
        setBuilderProject(result.builderProject)
        setProject(result.project)
        setTitle(result.builderProject.title)
        setDescription(result.builderProject.description)
        builderProjectRef.current = result.builderProject
        projectRef.current = result.project
        titleRef.current = result.builderProject.title
        descriptionRef.current = result.builderProject.description
        workspaceRef.current = result.project.workspace
        editRevisionRef.current = 0
        localWorkspaceVersionRef.current = 0
        savedRevisionRef.current = 0
        saveMutationRef.current = undefined
        inFlightSaveMutationRef.current = undefined
        conflictingWorkingCopyRef.current = undefined
        saveConflictRef.current = false
        workingCopyUpdatedAtRef.current = 0
        setEditRevision(0)
        setSaveState('saved')
        setSaveConflict(false)
        setSaveError('')
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(formatError(cause))
      })

    return () => {
      active = false
    }
  }, [id])

  React.useEffect(() => {
    if (!builderProject) return
    document.title = `${title || builderProject.title} | TanStack Builder`
  }, [builderProject, title])

  React.useEffect(() => {
    if (!isOwner) {
      setProjectSyncClient(undefined)
      return
    }

    let active = true
    let client: BuilderProjectSyncClient | undefined
    void createBuilderProjectSyncClient({
      projectId: id,
      onBackgroundError(cause) {
        if (!active) return
        const conflict =
          conflictingWorkingCopyRef.current !== undefined ||
          isBuilderProjectRevisionConflict(cause)
        setSaveState('error')
        setSaveConflict(conflict)
        setSaveError(
          conflict
            ? 'This project changed in another tab. Save this version as a fork.'
            : formatError(cause),
        )
      },
    })
      .then(async (nextClient) => {
        client = nextClient
        let startupSyncError: unknown
        try {
          await nextClient.flushOutbox()
        } catch (cause) {
          startupSyncError = cause
        }
        const initialSyncedProject = getBuilderProjectSyncProject(nextClient)
        if (!initialSyncedProject) {
          throw new Error('Builder project sync state is unavailable.')
        }
        const initialWorkingCopy = await reconcileBuilderProjectWorkingCopy({
          projectId: id,
          currentRevisionId: initialSyncedProject.currentRevisionId,
          currentRevisionNumber: initialSyncedProject.currentRevisionNumber,
        })
        if (
          initialWorkingCopy.status !== 'conflict' &&
          !isBuilderProjectRevisionConflict(startupSyncError) &&
          user?.userId
        ) {
          try {
            for (const scope of [`local-draft:${id}`, `${user.userId}:${id}`]) {
              const acknowledgement = await promoteBuilderProjectTranscript({
                projectId: id,
                scope,
                clientMutationId:
                  getBuilderProjectTranscriptImportMutationId(id),
              })
              if (acknowledgement) {
                await nextClient.collection.utils.waitForSequence(
                  acknowledgement.sequence,
                )
              }
            }
          } catch (cause) {
            startupSyncError ??= cause
          }
        }
        await settleBuilderProjectBootstrap({
          getSyncedProject: () => getBuilderProjectSyncProject(nextClient),
          getLocalVersion: () => editRevisionRef.current,
          isActive: () => active,
          loadSnapshot: getBuilderProjectSnapshot,
          async reconcileWorkingCopy(syncedProject) {
            await workingCopyQueueRef.current
            return reconcileBuilderProjectWorkingCopy({
              projectId: id,
              currentRevisionId: syncedProject.currentRevisionId,
              currentRevisionNumber: syncedProject.currentRevisionNumber,
            })
          },
          commit({ project: syncedProject, snapshot, workingCopy }) {
            const currentBuilderProject = builderProjectRef.current
            if (!currentBuilderProject) return
            const nextBuilderProject = mergeBuilderProjectSyncState(
              currentBuilderProject,
              syncedProject,
            )
            const startupConflict =
              workingCopy.status === 'conflict' ||
              isBuilderProjectRevisionConflict(startupSyncError)
            const restoredProject =
              workingCopy.status === 'ready'
                ? workingCopy.workingCopy.project
                : snapshot

            builderProjectRef.current = nextBuilderProject
            projectRef.current = restoredProject
            workspaceRef.current = restoredProject.workspace
            titleRef.current =
              workingCopy.status === 'ready'
                ? restoredProject.title
                : syncedProject.title
            descriptionRef.current =
              workingCopy.status === 'ready'
                ? restoredProject.description
                : syncedProject.description
            saveConflictRef.current = startupConflict
            if (!startupConflict) {
              conflictingWorkingCopyRef.current = undefined
            }

            setBuilderProject(nextBuilderProject)
            setProject(restoredProject)
            setTitle(titleRef.current)
            setDescription(descriptionRef.current)
            setSaveConflict(startupConflict)
            setSaveError('')
            setSaveState(startupConflict ? 'error' : 'saved')

            if (workingCopy.status === 'ready') {
              const revision = 1
              if (startupConflict) {
                conflictingWorkingCopyRef.current = workingCopy.workingCopy
              }
              editRevisionRef.current = revision
              savedRevisionRef.current = 0
              saveMutationRef.current = {
                editRevision: revision,
                clientMutationId: workingCopy.workingCopy.clientMutationId,
                revisionId: workingCopy.workingCopy.revisionId,
                baseRevisionId: workingCopy.workingCopy.baseRevisionId,
                expectedRevisionNumber:
                  workingCopy.workingCopy.expectedRevisionNumber,
              }
              workingCopyUpdatedAtRef.current =
                workingCopy.workingCopy.updatedAt
              setEditRevision(revision)
              setHasLocalChanges(true)
              if (!startupConflict) setSaveState('unsaved')
            } else if (workingCopy.status === 'conflict') {
              conflictingWorkingCopyRef.current = workingCopy.workingCopy
              setSaveError(
                'Recovered changes were based on an older project revision. Save them as a fork.',
              )
            }

            if (startupSyncError !== undefined) {
              setSaveState('error')
              setSaveConflict(startupConflict)
              setSaveError(
                startupConflict
                  ? 'This project changed in another tab. Save this version as a fork.'
                  : formatError(startupSyncError),
              )
            }
            projectSyncClientRef.current = nextClient
            setProjectSyncClient(nextClient)
          },
        })

        if (!active) void nextClient.cleanup()
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(formatError(cause))
      })

    return () => {
      active = false
      setProjectSyncClient(undefined)
      if (client) {
        if (projectSyncClientRef.current === client) {
          projectSyncClientRef.current = undefined
        }
        void client.cleanup()
      }
    }
  }, [id, isOwner, user?.userId])

  React.useEffect(
    () => () => {
      if (copiedTimeoutRef.current !== undefined) {
        window.clearTimeout(copiedTimeoutRef.current)
      }
    },
    [],
  )

  const reconcileSyncedProject = React.useCallback(
    (syncedProject: BuilderProjectSyncProject) => {
      const current = builderProjectRef.current
      if (!current || current.id !== syncedProject.id) return

      const nextBuilderProject = mergeBuilderProjectSyncState(
        current,
        syncedProject,
      )
      const pendingRevision = pendingAiRevisionRef.current
      const pendingSave =
        inFlightSaveMutationRef.current?.revisionId ===
        syncedProject.currentRevisionId
          ? inFlightSaveMutationRef.current
          : saveMutationRef.current?.revisionId ===
              syncedProject.currentRevisionId
            ? saveMutationRef.current
            : undefined
      const revisionChanged =
        current.currentRevisionId !== syncedProject.currentRevisionId

      if (!revisionChanged) {
        builderProjectRef.current = nextBuilderProject
        setBuilderProject(nextBuilderProject)
        if (
          editRevisionRef.current === savedRevisionRef.current &&
          !aiTransactionActiveRef.current
        ) {
          titleRef.current = syncedProject.title
          descriptionRef.current = syncedProject.description
          setTitle(syncedProject.title)
          setDescription(syncedProject.description)
        }
        return
      }

      if (pendingRevision?.id === syncedProject.currentRevisionId) {
        builderProjectRef.current = nextBuilderProject
        projectRef.current = pendingRevision.project
        workspaceRef.current = pendingRevision.project.workspace
        savedRevisionRef.current = pendingRevision.editRevision
        setBuilderProject(nextBuilderProject)
        setSaveConflict(false)
        setSaveError('')
        setSaveState(
          editRevisionRef.current === pendingRevision.editRevision
            ? 'saved'
            : 'unsaved',
        )
        void clearBuilderProjectWorkingCopy({
          projectId: id,
          clientMutationId: pendingRevision.workingCopy.clientMutationId,
          revisionId: pendingRevision.id,
        }).catch((cause: unknown) => {
          setSaveState('error')
          setSaveError(formatError(cause))
        })
        pendingAiRevisionRef.current = undefined
        return
      }

      if (pendingSave) {
        builderProjectRef.current = nextBuilderProject
        savedRevisionRef.current = Math.max(
          savedRevisionRef.current,
          pendingSave.editRevision,
        )
        setBuilderProject(nextBuilderProject)
        setSaveConflict(false)
        setSaveError('')
        setSaveState(
          editRevisionRef.current === pendingSave.editRevision
            ? 'saved'
            : 'unsaved',
        )
        void clearBuilderProjectWorkingCopy({
          projectId: id,
          clientMutationId: pendingSave.clientMutationId,
          revisionId: pendingSave.revisionId,
        }).catch((cause: unknown) => {
          setSaveState('error')
          setSaveError(formatError(cause))
        })
        return
      }

      if (
        aiTransactionActiveRef.current ||
        editRevisionRef.current > savedRevisionRef.current
      ) {
        setSaveConflict(true)
        setSaveState('error')
        setSaveError(
          'This project changed in another tab. Save this version as a fork.',
        )
        return
      }

      const syncClient = projectSyncClientRef.current
      if (!syncClient) return
      syncedRevisionRequestRef.current = syncedProject.currentRevisionId
      void settleBuilderProjectRevisionHydration({
        project: syncedProject,
        getLocalVersion: () => localWorkspaceVersionRef.current,
        getSyncedProject: () => getBuilderProjectSyncProject(syncClient),
        isActive: () =>
          projectSyncClientRef.current === syncClient &&
          syncedRevisionRequestRef.current === syncedProject.currentRevisionId,
        loadSnapshot: getBuilderProjectSnapshot,
        onLocalChange() {
          syncedRevisionRequestRef.current = undefined
          saveConflictRef.current = true
          setSaveConflict(true)
          setSaveState('error')
          setSaveError(
            'This project changed in another tab. Save this version as a fork.',
          )
        },
        commit({ project: latestSyncedProject, snapshot: nextProject }) {
          const latestBuilderProject = mergeBuilderProjectSyncState(
            current,
            latestSyncedProject,
          )
          builderProjectRef.current = latestBuilderProject
          projectRef.current = nextProject
          workspaceRef.current = nextProject.workspace
          titleRef.current = latestSyncedProject.title
          descriptionRef.current = latestSyncedProject.description
          setBuilderProject(latestBuilderProject)
          setProject(nextProject)
          setTitle(latestSyncedProject.title)
          setDescription(latestSyncedProject.description)
          setSaveConflict(false)
          setSaveError('')
          setSaveState('saved')
        },
      }).catch((cause: unknown) => {
        if (
          syncedRevisionRequestRef.current === syncedProject.currentRevisionId
        ) {
          setSaveState('error')
          setSaveError(formatError(cause))
        }
      })
    },
    [id],
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
  }, [
    aiTransactionActive,
    editRevision,
    flushPendingSave,
    isOwner,
    projectSyncClient,
  ])

  const definition = React.useMemo(
    () => (project ? sharedProjectToExampleDefinition(id, project) : undefined),
    [id, project],
  )

  function markEdited() {
    if (saveConflictRef.current) return
    localWorkspaceVersionRef.current += 1
    const revision = editRevisionRef.current + 1
    editRevisionRef.current = revision
    setEditRevision(revision)
    setSaveState('unsaved')
    void persistWorkingCopy(revision).catch((cause: unknown) => {
      setSaveState('error')
      setSaveError(formatError(cause))
    })
  }

  function updateWorkspace(workspace: ExampleWorkspace) {
    workspaceRef.current = workspace
    setHasLocalChanges(true)
    if (isOwner) markEdited()
  }

  function applyAiExecution(
    execution: BuilderAiExecution,
    signal: AbortSignal,
  ) {
    const currentProject = projectRef.current
    const currentWorkspace = workspaceRef.current
    if (!currentProject || !currentWorkspace || signal.aborted) {
      return Promise.resolve({
        ok: false as const,
        phase: 'superseded' as const,
        message: 'The builder editor is no longer available.',
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
    const resetWorkbench = requiresBuilderWorkbenchReset(
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
      throw new Error('The builder editor is no longer available.')
    }
    aiTransactionActiveRef.current = true
    localWorkspaceVersionRef.current += 1
    setAiTransactionActive(true)
    return {
      runtime: currentProject.runtime ?? null,
      workspace: currentWorkspace,
    }
  }

  async function commitAiExecution(execution: BuilderAiExecution) {
    const currentProject = projectRef.current
    if (!currentProject) {
      throw new Error('The builder editor is no longer available.')
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
    setHasLocalChanges(true)
    if (!isOwner) return

    const currentBuilderProject = builderProjectRef.current
    if (
      !currentBuilderProject?.currentRevisionId ||
      !currentBuilderProject.currentRevisionNumber
    ) {
      throw new Error('The Builder project revision is unavailable.')
    }

    setSaveState('saving')
    setSaveError('')
    const revisionId = crypto.randomUUID()
    const clientMutationId = crypto.randomUUID()
    const expectedRevisionNumber = currentBuilderProject.currentRevisionNumber
    workingCopyUpdatedAtRef.current = Math.max(
      Date.now(),
      workingCopyUpdatedAtRef.current + 1,
    )
    const durableAiProject: BuilderProjectWorkingCopy = {
      projectId: id,
      clientMutationId,
      revisionId,
      baseRevisionId: currentBuilderProject.currentRevisionId,
      expectedRevisionNumber,
      project: nextProject,
      updatedAt: workingCopyUpdatedAtRef.current,
    }
    const queuedWorkingCopy = workingCopyQueueRef.current
      .catch(() => {})
      .then(async () => {
        await saveBuilderProjectWorkingCopy(durableAiProject)
      })
    workingCopyQueueRef.current = queuedWorkingCopy
    await queuedWorkingCopy
    let snapshotHash: string
    try {
      snapshotHash = await storeBuilderProjectRevision(nextProject)
    } catch (cause) {
      const recoveryEditRevision = editRevisionRef.current + 1
      editRevisionRef.current = recoveryEditRevision
      saveMutationRef.current = {
        editRevision: recoveryEditRevision,
        clientMutationId,
        revisionId,
        baseRevisionId: currentBuilderProject.currentRevisionId,
        expectedRevisionNumber,
      }
      setEditRevision(recoveryEditRevision)
      setSaveState('error')
      setSaveError(formatError(cause))
      throw cause
    }
    const revision = {
      id: revisionId,
      clientMutationId,
      snapshotHash,
      title: nextProject.title,
      description: nextProject.description,
      expectedRevisionNumber,
    }
    pendingAiRevisionRef.current = {
      editRevision: editRevisionRef.current,
      id: revision.id,
      project: nextProject,
      workingCopy: durableAiProject,
    }
    return revision
  }

  function finishAiExecution() {
    aiTransactionActiveRef.current = false
    localWorkspaceVersionRef.current += 1
    setAiTransactionActive(false)
  }

  function handleAiRevisionConflict(revision: BuilderAssistantRevisionCommit) {
    const pendingRevision = pendingAiRevisionRef.current
    if (!pendingRevision || pendingRevision.id !== revision.id) return
    conflictingWorkingCopyRef.current = pendingRevision.workingCopy
    saveConflictRef.current = true
    setSaveState('error')
    setSaveConflict(true)
    setSaveError(
      'This project changed in another tab. Save this version as a fork.',
    )
  }

  async function restoreAiExecution(
    execution: BuilderAiExecution,
    reason: 'manual' | 'rollback',
  ) {
    const currentProject = projectRef.current
    const currentWorkspace = workspaceRef.current
    if (!currentProject || !currentWorkspace) {
      throw new Error('The builder editor is no longer available.')
    }

    await applyAiExecution(execution, new AbortController().signal)
    if (reason === 'manual') {
      setHasLocalChanges(true)
      if (isOwner) markEdited()
    }
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

  async function fork() {
    if (!builderProject || !project || !workspaceRef.current) return
    const resolvingConflict = saveConflict
    const forkProject =
      (resolvingConflict
        ? conflictingWorkingCopyRef.current?.project
        : undefined) ??
      createCurrentProjectSnapshot() ??
      project
    const conflictingWorkingCopy = resolvingConflict
      ? conflictingWorkingCopyRef.current
      : undefined
    const conflictingSaveMutation = resolvingConflict
      ? saveMutationRef.current
      : undefined
    setForking(true)
    if (!resolvingConflict) setSaveError('')

    try {
      const forkMutation = forkMutationRef.current ?? {
        clientMutationId: crypto.randomUUID(),
        id: crypto.randomUUID(),
        revisionId: crypto.randomUUID(),
      }
      forkMutationRef.current = forkMutation
      setForkTranscriptLocked(true)
      const transcriptImportMutationId =
        getBuilderProjectTranscriptImportMutationId(forkMutation.id)
      const existingTranscript = forkTranscriptRef.current
      const sourceScope = forkSourceScopeRef.current
      const transcript =
        existingTranscript?.projectId === forkMutation.id
          ? existingTranscript
          : {
              ...(await prepareBuilderProjectForkTranscriptImport({
                clientMutationId: transcriptImportMutationId,
                source: sourceScope
                  ? { type: 'local', scope: sourceScope }
                  : {
                      type: 'sync',
                      rows: projectSyncClient
                        ? [...projectSyncClient.collection.values()]
                        : [],
                    },
              })),
              projectId: forkMutation.id,
              project: forkProject,
            }
      forkTranscriptRef.current = transcript
      const nextProject = await createBuilderProject(
        createSharedExampleProject({
          title: transcript.project.title.trim() || 'Untitled project',
          description: transcript.project.description.trim(),
          initialFile: transcript.project.initialFile,
          hiddenFiles: transcript.project.hiddenFiles,
          runtime: transcript.project.runtime,
          workspace: transcript.project.workspace,
        }),
        { ...forkMutation, forkedFromId: builderProject.id },
      )
      await importBuilderProjectTranscriptCommands({
        projectId: nextProject.id,
        commands: transcript.commands,
      })
      const conflictMutationId =
        conflictingWorkingCopy?.clientMutationId ??
        conflictingSaveMutation?.clientMutationId
      const conflictRevisionId =
        conflictingWorkingCopy?.revisionId ??
        conflictingSaveMutation?.revisionId
      if (conflictMutationId) {
        await discardBuilderProjectSyncCommand(id, conflictMutationId)
      }
      if (conflictMutationId && conflictRevisionId) {
        await clearBuilderProjectWorkingCopy({
          projectId: id,
          clientMutationId: conflictMutationId,
          revisionId: conflictRevisionId,
        })
      }
      if (transcript.localSnapshot) {
        await removeBuilderAiTranscriptScopeSnapshot(transcript.localSnapshot)
      }
      forkMutationRef.current = undefined
      forkSourceScopeRef.current = undefined
      forkTranscriptRef.current = undefined
      conflictingWorkingCopyRef.current = undefined
      savedRevisionRef.current = editRevisionRef.current
      setSaveState('saved')
      setForking(false)
      setForkTranscriptLocked(false)
      try {
        await navigate({
          to: '/builder/$id',
          params: { id: nextProject.id },
        })
      } catch {
        window.location.assign(`/builder/${nextProject.id}`)
      }
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

  async function forkAfterAuthentication() {
    if (assistantRunning) return

    const sourceScope = `${user?.userId ?? 'anonymous'}:${builderProject?.id}`
    try {
      await assistantRef.current?.persistTranscript()
      forkSourceScopeRef.current = sourceScope
    } catch (cause) {
      setSaveError(formatError(cause))
      return
    }

    if (user) {
      await fork()
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
          <h1 className="text-2xl font-semibold">Project unavailable</h1>
          <p className="mt-2 text-sm text-text-muted">{loadError}</p>
          <Button
            as={Link}
            to="/builder"
            variant="ghost"
            size="sm"
            className="mt-6"
          >
            <ArrowLeftIcon className="size-4" aria-hidden="true" />
            Builder
          </Button>
        </div>
      </main>
    )
  }

  if (
    !builderProject ||
    !project ||
    !definition ||
    userQuery.isPending ||
    (isOwner && !projectSyncClient)
  ) {
    return <BuilderEditorSkeleton />
  }

  const authorName = builderProject.author.name || 'TanStack user'
  const parentId = builderProject.forkedFromId
  const shareLabel =
    hasLocalChanges && !isOwner ? 'Copy original project link' : 'Copy link'
  const renderAssistant = (projectSync?: BuilderAssistantProjectSync) => (
    <BuilderAssistant
      key={`${builderProject.id}:${user?.userId ?? 'anonymous'}`}
      ref={assistantRef}
      credentialScope={user?.userId ?? 'anonymous'}
      enabled={!forkTranscriptLocked}
      getExecution={() => {
        return {
          runtime: projectRef.current?.runtime ?? null,
          workspace: workspaceRef.current ?? project.workspace,
        }
      }}
      hiddenFiles={projectRef.current?.hiddenFiles ?? project.hiddenFiles ?? []}
      onApply={applyAiExecution}
      onCommit={commitAiExecution}
      onDismiss={() => setActiveView('code')}
      onFinish={finishAiExecution}
      onPrepare={prepareAiExecution}
      onRevisionConflict={handleAiRevisionConflict}
      onRestore={restoreAiExecution}
      onRunningChange={setAssistantRunning}
      projectSync={projectSync}
      storageScope={
        projectSync
          ? undefined
          : `${user?.userId ?? 'anonymous'}:${builderProject.id}`
      }
    />
  )

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
          {isOwner ? (
            <>
              <input
                aria-label="Builder title"
                value={title}
                maxLength={160}
                disabled={saveConflict}
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
                disabled={saveConflict}
                placeholder="Add a description"
                onChange={(event) => updateDescription(event.target.value)}
                className="block w-full truncate rounded-sm bg-transparent text-xs text-text-muted outline-none placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-border-focus"
              />
            </>
          ) : (
            <>
              <h1 className="truncate text-sm font-semibold">
                {builderProject.title}
              </h1>
              <div className="flex items-center gap-1.5 truncate text-xs text-text-muted">
                {builderProject.author.image ? (
                  <img
                    src={builderProject.author.image}
                    alt=""
                    className="size-4 rounded-full"
                  />
                ) : null}
                <span className="truncate">{authorName}</span>
                <span className="hidden sm:inline">
                  · Updated {formatDate(builderProject.updatedAt)}
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
              aria-label="Open the builder this was forked from"
              onClick={() =>
                void navigate({
                  to: '/builder/$id',
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
              href={`mailto:support@tanstack.com?subject=${encodeURIComponent(`Report Builder project ${builderProject.id}`)}&body=${encodeURIComponent(window.location.href)}`}
              variant="ghost"
              size="xs"
              rounded="none"
              aria-label="Report Builder project"
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
            aria-label={copied ? 'Builder link copied' : shareLabel}
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
              disabled={forking || assistantRunning}
              aria-label={
                hasLocalChanges ? 'Fork to save local changes' : 'Fork builder'
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
              disabled={forking || assistantRunning}
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

      {!isOwner && builderProject.description ? (
        <p
          className="shrink-0 truncate border-b border-border-default px-4 py-2 text-xs text-text-muted"
          title={builderProject.description}
        >
          {builderProject.description}
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

      <div className="flex min-h-0 flex-1" inert={forkTranscriptLocked}>
        <ExampleWorkbench
          alternateEditor={{
            active: activeView === 'chat',
            label: 'Chat',
            onActiveChange: (active) => setActiveView(active ? 'chat' : 'code'),
            submitPrompt: (content, lifecycle) =>
              assistantRef.current?.submitPrompt(content, lifecycle) ?? false,
            content: projectSyncClient ? (
              <BuilderProjectSyncRows
                client={projectSyncClient}
                onProject={reconcileSyncedProject}
              >
                {renderAssistant}
              </BuilderProjectSyncRows>
            ) : (
              renderAssistant()
            ),
          }}
          autoRun={shouldAutoRunBuilder(window.navigator)}
          className="w-full"
          definition={definition}
          fullscreen
          filesInitiallyOpen
          runDisabled={assistantRunning || forkTranscriptLocked || saveConflict}
          runLabel="Run builder"
          runRequest={runRequest}
          workbenchRef={workbenchRef}
          onWorkspaceChange={updateWorkspace}
        />
      </div>
    </main>
  )
}

function BuilderProjectSyncRows({
  children,
  client,
  onProject,
}: {
  children: (projectSync: BuilderAssistantProjectSync) => React.ReactNode
  client: BuilderProjectSyncClient
  onProject: (project: BuilderProjectSyncProject) => void
}) {
  const { data } = useLiveQuery(client.collection)
  const projectSync = React.useMemo(
    () => getBuilderAssistantProjectSync(client, data),
    [client, data],
  )

  React.useEffect(() => {
    if (projectSync) onProject(projectSync.project)
  }, [onProject, projectSync])

  return projectSync ? children(projectSync) : null
}

function getBuilderAssistantProjectSync(
  client: BuilderProjectSyncClient,
  rows: ReadonlyArray<BuilderProjectSyncRow>,
): BuilderAssistantProjectSync | undefined {
  let project: BuilderProjectSyncProject | undefined
  const threads: BuilderAssistantProjectSync['threads'][number][] = []
  const messages: BuilderAssistantProjectSync['messages'][number][] = []
  const runs: BuilderAssistantProjectSync['runs'][number][] = []

  for (const row of rows) {
    switch (row.kind) {
      case 'project':
        project = row.value
        break
      case 'thread':
        threads.push(row.value)
        break
      case 'message':
        messages.push(row.value)
        break
      case 'run':
        runs.push(row.value)
        break
    }
  }
  if (!project) return undefined

  return {
    browserSessionId: client.browserSessionId,
    project,
    threads,
    messages,
    runs,
    executeCommand: client.executeCommand,
    executeRunEnqueue: client.executeRunEnqueue,
  }
}

function getBuilderProjectSyncProject(client: BuilderProjectSyncClient) {
  for (const row of client.collection.values()) {
    if (row.kind === 'project') return row.value
  }
  return undefined
}

function mergeBuilderProjectSyncState(
  project: BuilderProject,
  syncedProject: BuilderProjectSyncProject,
): BuilderProject {
  return {
    ...project,
    forkedFromId: syncedProject.forkedFromId ?? undefined,
    title: syncedProject.title,
    description: syncedProject.description,
    snapshotHash: syncedProject.snapshotHash,
    currentRevisionId: syncedProject.currentRevisionId,
    currentRevisionNumber: syncedProject.currentRevisionNumber,
    createdAt: syncedProject.createdAt,
    updatedAt: syncedProject.updatedAt,
  }
}

function isBuilderProjectRevisionConflict(error: unknown) {
  return (
    error instanceof BuilderProjectSyncCommandRejectedError &&
    error.rejection.code === 'project-revision-conflict'
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
