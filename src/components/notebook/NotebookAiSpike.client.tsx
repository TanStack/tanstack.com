import * as React from 'react'
import { ArrowLeftIcon } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { Button } from '~/components/ds/ui'
import {
  ExampleWorkbench,
  type ExampleWorkbenchHandle,
  type ExampleWorkbenchRunResult,
  type ExampleWorkbenchRunRequest,
} from '~/components/examples/ExampleWorkbench.client'
import { NotebookAssistant } from '~/components/notebook/NotebookAssistant.client'
import { notebookStarterSource } from '~/utils/notebook-environment'
import {
  createExampleWorkspace,
  type ExampleDefinition,
  type ExampleWorkspace,
} from '~/utils/example-workspace'
import type { NotebookAiExecution } from '~/utils/notebook-ai'
import { shouldAutoRunNotebook } from '~/utils/notebook-auto-run.client'

const initialDefinition = {
  id: 'notebook-ai-spike',
  title: 'AI notebook spike',
  initialFile: '/index.tsx',
  workspace: createExampleWorkspace({
    entry: '/index.tsx',
    environment: 'client',
    files: { '/index.tsx': notebookStarterSource },
  }),
} satisfies ExampleDefinition

export function NotebookAiSpike() {
  const [activeView, setActiveView] = React.useState<'chat' | 'code'>('chat')
  const [definition, setDefinition] =
    React.useState<ExampleDefinition>(initialDefinition)
  const [runRequest, setRunRequest] =
    React.useState<ExampleWorkbenchRunRequest>()
  const workbenchRef = React.useRef<ExampleWorkbenchHandle>(null)
  const definitionRef = React.useRef(definition)
  const workspaceRef = React.useRef<ExampleWorkspace>(definition.workspace)
  definitionRef.current = definition

  function applyAiExecution(
    execution: NotebookAiExecution,
    signal: AbortSignal,
  ) {
    const currentDefinition = definitionRef.current
    const currentWorkspace = workspaceRef.current
    if (signal.aborted) {
      return Promise.resolve({
        ok: false,
        phase: 'superseded' as const,
        message: 'The notebook edit was stopped.',
      })
    }
    const hiddenFiles = getAiHiddenFiles(
      currentDefinition.hiddenFiles ?? [],
      execution.workspace,
    )
    const nextDefinition: ExampleDefinition = {
      id: currentDefinition.id,
      title: currentDefinition.title,
      ...(currentDefinition.description
        ? { description: currentDefinition.description }
        : {}),
      ...(currentDefinition.initialFile
        ? { initialFile: currentDefinition.initialFile }
        : {}),
      ...(hiddenFiles.length ? { hiddenFiles } : {}),
      ...(execution.runtime ? { runtime: execution.runtime } : {}),
      workspace: execution.workspace,
    }
    definitionRef.current = nextDefinition
    workspaceRef.current = execution.workspace

    if (
      !requiresWorkbenchReset(
        currentDefinition.runtime ?? null,
        currentWorkspace,
        execution,
      ) &&
      workbenchRef.current
    ) {
      return workbenchRef.current.replaceWorkspaceAndRun(
        execution.workspace,
        signal,
      )
    }

    setDefinition(nextDefinition)

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

  return (
    <main className="fixed inset-x-0 top-[var(--navbar-height)] bottom-0 z-20 flex min-h-0 flex-col overflow-hidden bg-background-default text-text-primary">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border-default bg-background-default px-3 sm:px-4">
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
          <h1 className="truncate text-sm font-semibold">AI notebook spike</h1>
          <p className="truncate text-xs text-text-muted">Local spike</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <ExampleWorkbench
          alternateEditor={{
            active: activeView === 'chat',
            label: 'Chat',
            onActiveChange: (active) => setActiveView(active ? 'chat' : 'code'),
            content: (
              <NotebookAssistant
                authenticated
                enabled={activeView === 'chat'}
                getExecution={() => ({
                  runtime: definitionRef.current.runtime ?? null,
                  workspace: workspaceRef.current,
                })}
                hiddenFiles={[]}
                onApply={applyAiExecution}
                storageScope="local-spike"
              />
            ),
          }}
          autoRun={shouldAutoRunNotebook(window.navigator)}
          className="w-full"
          definition={definition}
          fullscreen
          filesInitiallyOpen
          runLabel="Run notebook"
          runRequest={runRequest}
          workbenchRef={workbenchRef}
          onWorkspaceChange={(workspace) => {
            workspaceRef.current = workspace
          }}
        />
      </div>
    </main>
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
  hiddenFiles: ReadonlyArray<string>,
  workspace: ExampleWorkspace,
) {
  return [
    ...new Set([
      ...hiddenFiles,
      ...Object.keys(workspace.files).filter((path) =>
        path.startsWith('/.tanstack/'),
      ),
    ]),
  ]
}
