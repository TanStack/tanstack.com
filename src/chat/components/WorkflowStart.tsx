import { useEffect, useId, useRef, useState } from 'react'
import { z } from 'zod'
import { SelectField } from './SelectField'
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { RunModelSelection } from '../core/run-model'
import type { WorkflowDefinition } from '../core/workflows'
import type { WorkflowStart as StartCommand } from '../core/workflow-start'
import { useWorkspaceApi } from './WorkspaceApi'
import { WorkflowStartStore, workflowStartKey } from './workflow-start-store'

type SavedWorkflow = {
  id: string
  revision: number
  archived: boolean
  definition: WorkflowDefinition
}
export function WorkflowStart({
  conversationId,
  userId,
  model,
  readOnly,
}: {
  conversationId: string
  userId: string
  model?: RunModelSelection
  readOnly?: boolean
}) {
  const workflowId = useId()
  const api = useWorkspaceApi()
  const summaryRef = useRef<HTMLElement>(null)
  const client = useQueryClient()
  const [selected, setSelected] = useState('')
  const [pending, setPending] = useState<StartCommand | null>(null)
  const [storageError, setStorageError] = useState('')
  const [recoveryNotice, setRecoveryNotice] = useState('')
  const key = workflowStartKey(api.workspaceId, userId, conversationId)
  const path = `conversations/${encodeURIComponent(conversationId)}`
  useEffect(() => {
    try {
      setPending(new WorkflowStartStore(localStorage, key).read())
      setStorageError('')
    } catch {
      setStorageError('Could not recover the saved workflow request.')
    }
  }, [key])
  const saved = useInfiniteQuery({
    queryKey: ['workflow-definitions', api.workspaceId, userId, conversationId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      api.request<{ items: SavedWorkflow[]; nextAfter?: string }>(
        `${path}/workflows?limit=25${pageParam ? `&after=${encodeURIComponent(pageParam)}` : ''}`,
        undefined,
        'GET',
        { signal },
      ),
    getNextPageParam: (page) => page.nextAfter,
  })
  const choices =
    saved.data?.pages
      .flatMap((page) => page.items)
      .filter((item) => !item.archived) ?? []
  const choice = choices.find((item) => item.id === selected)
  const launch = useMutation({
    mutationFn: async () => {
      if (!navigator.locks)
        throw Error('This browser cannot safely start workflows.')
      return navigator.locks.request(key, async () => {
        const store = new WorkflowStartStore(localStorage, key)
        let command = store.read() ?? pending
        if (!command) {
          if (!choice || !model)
            throw Error('Select a workflow and model first.')
          command = store.save({
            commandId: crypto.randomUUID(),
            workflowId: choice.id,
            revision: choice.revision,
            model,
            references: [],
            concurrency: 2,
            durationMs: 1800000,
            operationLimits: { model: 24, tool: 48, repair: 8 },
          })
        }
        setPending(command)
        await api.request(`${path}/workflow-runs`, command)
        store.clear(command.commandId)
        summaryRef.current?.focus()
        setPending(null)
      })
    },
    onSettled: () =>
      client.invalidateQueries({
        queryKey: ['workflow-runs', api.workspaceId, userId, conversationId],
      }),
  })
  const withdraw = useMutation({
    mutationFn: async () => {
      if (!navigator.locks)
        throw Error('This browser cannot safely recover workflow requests.')
      return navigator.locks.request(key, async () => {
        const store = new WorkflowStartStore(localStorage, key)
        const command = store.read() ?? pending
        if (!command) throw Error('No pending workflow request.')
        const result = z
          .discriminatedUnion('status', [
            z.strictObject({ status: z.literal('withdrawn') }),
            z.strictObject({ status: z.literal('admitted'), runId: z.uuid() }),
          ])
          .parse(await api.request(`${path}/workflow-runs/withdraw`, command))
        if (result.status === 'admitted' && result.runId !== command.commandId)
          throw Error('The workflow receipt does not match this request.')
        store.clear(command.commandId)
        setPending(null)
        launch.reset()
        setRecoveryNotice(
          result.status === 'withdrawn'
            ? 'Start request withdrawn.'
            : 'This workflow already started. Its run is listed below; use Stop there if needed.',
        )
        summaryRef.current?.focus()
      })
    },
    onSettled: () =>
      client.invalidateQueries({
        queryKey: ['workflow-runs', api.workspaceId, userId, conversationId],
      }),
  })
  return (
    <details
      className="workflow-start"
      onToggle={(event) => {
        if (event.currentTarget.open) void saved.refetch()
      }}
    >
      <summary ref={summaryRef}>Start a workflow</summary>
      {saved.error && <p role="alert">Could not load saved workflows.</p>}
      {storageError && <p role="alert">{storageError}</p>}
      {pending ? (
        <p>
          Retry with {pending.model.model} or withdraw this request. A workflow
          that already started will continue.
        </p>
      ) : (
        <>
          <label htmlFor={workflowId}>
            Workflow
            <SelectField
              id={workflowId}
              aria-label="Workflow"
              value={selected}
              items={[
                { value: '', label: 'Choose a saved workflow' },
                ...choices.map((item) => ({
                  value: item.id,
                  label: item.definition.name,
                })),
              ]}
              onValueChange={(value) => {
                setSelected(value)
                launch.reset()
              }}
              disabled={launch.isPending || readOnly}
            />
          </label>
          {saved.hasNextPage && (
            <button
              type="button"
              disabled={saved.isFetchingNextPage}
              onClick={() => void saved.fetchNextPage()}
            >
              Load more workflows
            </button>
          )}
          {choice && (
            <>
              <ol>
                {choice.definition.steps.map((step) => (
                  <li key={step.id}>
                    {step.name}: {step.objective}
                  </li>
                ))}
              </ol>
              <p>
                {model?.model ?? 'Choose a model in the conversation.'} · Up to
                30 minutes, 24 model calls and 48 tool calls. No conversation or
                file references attached.
              </p>
            </>
          )}
        </>
      )}
      <button
        type="button"
        disabled={
          readOnly ||
          !!storageError ||
          launch.isPending ||
          withdraw.isPending ||
          (!pending && (!choice || !model))
        }
        onClick={() => {
          setRecoveryNotice('')
          withdraw.reset()
          launch.mutate()
        }}
      >
        {launch.isPending
          ? 'Starting…'
          : pending
            ? 'Retry start'
            : 'Start workflow'}
      </button>
      {pending && (
        <button
          type="button"
          disabled={
            readOnly || !!storageError || launch.isPending || withdraw.isPending
          }
          onClick={() => withdraw.mutate()}
        >
          {withdraw.isPending ? 'Checking start…' : 'Withdraw start request'}
        </button>
      )}
      {withdraw.isError && (
        <p role="alert">
          Could not confirm withdrawal. The saved request is retained; retry
          withdrawal to check safely.
        </p>
      )}
      {recoveryNotice && <p role="status">{recoveryNotice}</p>}
      {launch.isError && !withdraw.isError && (
        <p role="alert">
          Could not confirm the start. Retry uses the same request and will not
          create a second run.
        </p>
      )}
      {launch.isSuccess && <p role="status">Workflow started.</p>}
    </details>
  )
}
