import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ToolResultPart } from '@tanstack/ai'
import type { ConversationDestination } from '../core/conversation-destination'
import type { ActionEvidence } from '../core/retry-source'
import {
  parseActionEvidenceView,
  type ActionEvidenceView,
} from '../core/action-evidence-view'
import { ConversationTurn, groupConversation } from './ConversationTurn'
import { useWorkspaceApi } from './WorkspaceApi'
import './retry.css'

export function ConversationActionEvidence({
  destination,
  operationId,
  editorVisible = false,
  visible = true,
}: {
  destination: ConversationDestination
  operationId: string
  editorVisible?: boolean
  visible?: boolean
}) {
  const { request } = useWorkspaceApi()
  const query = useQuery({
    queryKey: [
      'conversation-action-evidence',
      destination.userId,
      destination.workspaceId,
      destination.botId,
      destination.conversationId,
      operationId,
    ],
    queryFn: async ({ signal }) =>
      parseActionEvidenceView(
        await request(
          `${destination.apiPath}/action-evidence`,
          undefined,
          'GET',
          {
            signal,
          },
        ),
        operationId,
      ),
    enabled: visible,
    refetchOnMount: 'always',
    staleTime: 0,
    retry: false,
  })
  // Old cache entries do not establish the current copy's identity. In
  // particular, a reset or failed refresh must not show its earlier records.
  const view =
    query.isFetchedAfterMount && !query.error ? query.data : undefined
  const mismatch = view && view.operationId !== operationId
  const error =
    query.error?.message ||
    (mismatch
      ? 'This conversation changed. Check its action history again.'
      : undefined)
  if (error)
    return (
      <div className="retry-preparation" role="alert">
        <span>{error}</span>
        <button
          type="button"
          className="quiet-button"
          disabled={query.isFetching || !visible}
          onClick={() => void query.refetch()}
        >
          Check again
        </button>
      </div>
    )
  if (!view) return null
  return (
    <ActionEvidenceRecords
      view={view}
      messageScope={destination.sessionKey}
      editorVisible={editorVisible}
    />
  )
}

export function ActionEvidenceRecords({
  view,
  messageScope,
  editorVisible = false,
}: {
  view: ActionEvidenceView
  messageScope: string
  editorVisible?: boolean
}) {
  const current = view.records.find(
    (record) => record.id === view.currentEvidenceId,
  )
  const inherited = view.records.filter(
    (record) => record.id !== view.currentEvidenceId,
  )
  if (!view.records.length) return null
  return (
    <div className="conversation-action-evidence">
      {current && (
        <ActionEvidenceRecord
          key={current.id}
          record={current}
          messageScope={messageScope}
          label="Previous attempt"
          showPrompt={!editorVisible}
          explain
        />
      )}
      {inherited.length > 0 && (
        <details className="retry-evidence inherited-action-evidence">
          <summary>Earlier attempts · {inherited.length}</summary>
          <div className="inherited-action-evidence-body">
            <p>
              Earlier actions are not undone. New actions use fresh approvals.
            </p>
            {inherited.map((record) => (
              <ActionEvidenceRecord
                key={record.id}
                record={record}
                messageScope={messageScope}
                label={
                  record.source.request.text.trim() || 'Request with files'
                }
                showPrompt
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function ActionEvidenceRecord({
  record,
  messageScope,
  label,
  showPrompt,
  explain = false,
}: {
  record: ActionEvidence
  messageScope: string
  label: string
  showPrompt: boolean
  explain?: boolean
}) {
  const evidence = record.source.evidence
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const calls = evidence.messages.flatMap((message) =>
    message.parts.filter((part) => part.type === 'tool-call'),
  )
  const unknown = evidence.receipts.filter(
    (receipt) =>
      receipt.executionOutcome === 'unknown' || receipt.status === 'running',
  ).length
  const results = new Map<string, ToolResultPart>(
    evidence.messages.flatMap((message) =>
      message.parts.flatMap((part) =>
        part.type === 'tool-result' ? [[part.toolCallId, part] as const] : [],
      ),
    ),
  )
  const turn = groupConversation(evidence.messages)[0]
  return (
    <details className="retry-evidence">
      <summary>
        <span className="action-evidence-label">{label}</span>
        {calls.length
          ? ` · ${calls.length} tool ${calls.length === 1 ? 'call' : 'calls'}`
          : ''}
        {unknown
          ? ` · ${unknown} outcome${unknown === 1 ? '' : 's'} unconfirmed`
          : ''}
      </summary>
      <div className="retry-evidence-body">
        {explain && (
          <p>
            Earlier actions are not undone. New actions use fresh approvals.
          </p>
        )}
        {turn && (
          <ConversationTurn
            turn={showPrompt ? turn : { ...turn, prompt: undefined }}
            name="Previous response"
            outcome={evidence.outcome}
            running={false}
            waiting={false}
            failed={evidence.outcome?.status === 'error'}
            results={results}
            expanded={expanded}
            setExpanded={(id, open) =>
              setExpanded((previous) => ({ ...previous, [id]: open }))
            }
            inherited={{ partial: evidence.partial }}
            receipts={evidence.receipts}
            messageScope={JSON.stringify([
              messageScope,
              'action-evidence',
              record.id,
            ])}
          />
        )}
      </div>
    </details>
  )
}
