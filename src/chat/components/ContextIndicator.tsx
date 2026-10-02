import { useContext, useEffect, useRef, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { CircleGauge, X } from 'lucide-react'
import type { UsageStep } from '../core/usage'
import { IconButton } from './IconButton'
import { PortalContainer } from './PortalContainer'
import { contextSummary, type ContextSummary } from './context-summary'
import './context-indicator.css'

const number = (value: number) => value.toLocaleString()
const bytes = (value: number) => `${number(value)} bytes`

export function RequestContextDetails({
  summary,
}: {
  summary: ContextSummary
}) {
  const {
    step,
    context,
    inputTokens,
    cachedInputTokens,
    inputTokensExcludeCache,
    attemptOrdinal,
    usageState,
    responseIncomplete,
  } = summary
  return (
    <div className="request-context-details">
      <p className="request-context-model">
        {step.provider}
        {step.model && ` / ${step.model}`}
      </p>
      <dl>
        <div>
          <dt>Reported input tokens</dt>
          <dd>
            {inputTokens === undefined
              ? usageState === 'invalid'
                ? 'Invalid provider usage'
                : 'Not reported'
              : number(inputTokens)}
          </dd>
        </div>
        {cachedInputTokens !== undefined && (
          <div>
            <dt>Cached input tokens</dt>
            <dd>{number(cachedInputTokens)}</dd>
          </div>
        )}
        {context && (
          <div>
            <dt>Prepared messages</dt>
            <dd>{number(context.history.retainedMessages)}</dd>
          </div>
        )}
      </dl>
      {inputTokensExcludeCache && (
        <p className="request-context-note">
          This provider reports cached input separately. Cached tokens are not
          included here.
        </p>
      )}
      <p className="request-context-note">
        {attemptOrdinal === undefined
          ? 'No provider attempt was recorded for this request.'
          : step.outcome === 'running'
            ? 'This request is still running.'
            : responseIncomplete
              ? 'The provider response did not finish.'
              : 'From the last model request.'}{' '}
        Your unsent draft is not included.
      </p>
      {attemptOrdinal !== undefined && attemptOrdinal > 1 && (
        <p>Usage is from attempt {attemptOrdinal}, not the sum of retries.</p>
      )}
      {context ? (
        <>
          {(context.history.compactedMessages > 0 ||
            context.history.archivedLargeMessages > 0) && (
            <p>
              Some content was saved by reference to make room. Omitted
              attachment payloads need to be attached again.
            </p>
          )}
          <details>
            <summary>How TanChat prepared this request</summary>
            <dl>
              <div>
                <dt>History before trimming</dt>
                <dd>{bytes(context.history.inputBytes)}</dd>
              </div>
              <div>
                <dt>History kept</dt>
                <dd>{bytes(context.history.retainedBytes)}</dd>
              </div>
              <div>
                <dt>TanChat history limit</dt>
                <dd>{bytes(context.history.budgetBytes)}</dd>
              </div>
              <div>
                <dt>Messages moved to references</dt>
                <dd>{number(context.history.compactedMessages)}</dd>
              </div>
              <div>
                <dt>Large messages archived</dt>
                <dd>{number(context.history.archivedLargeMessages)}</dd>
              </div>
              {!!context.history.pinnedEvidenceMessages && (
                <div>
                  <dt>Earlier action records kept</dt>
                  <dd>{number(context.history.pinnedEvidenceMessages)}</dd>
                </div>
              )}
              <div>
                <dt>Instructions</dt>
                <dd>{bytes(context.request.systemPromptBytes)}</dd>
              </div>
              <div>
                <dt>Tool definitions</dt>
                <dd>
                  {number(context.request.tools)} ·{' '}
                  {bytes(context.request.toolDefinitionBytes)}
                </dd>
              </div>
              {context.request.outputSchemaBytes !== undefined && (
                <div>
                  <dt>Output schema</dt>
                  <dd>{bytes(context.request.outputSchemaBytes)}</dd>
                </div>
              )}
              {!!context.request.mediaParts && (
                <div>
                  <dt>Media parts</dt>
                  <dd>{number(context.request.mediaParts)}</dd>
                </div>
              )}
              {!!context.request.attachmentPayloadMessages && (
                <div>
                  <dt>Messages with attached content</dt>
                  <dd>{number(context.request.attachmentPayloadMessages)}</dd>
                </div>
              )}
            </dl>
            <p>
              These are serialized input sizes, excluding attachment payloads
              and provider overhead. The history limit excludes instructions and
              tool definitions. It is not the model’s token limit.
            </p>
          </details>
        </>
      ) : (
        <p>Context preparation was not recorded for this request.</p>
      )}
    </div>
  )
}

export function ContextIndicator({
  steps,
  taskId,
  transcriptEpoch,
  visible,
}: {
  steps: readonly UsageStep[]
  taskId?: string
  transcriptEpoch?: string
  visible: boolean
}) {
  const container = useContext(PortalContainer)
  const [open, setOpen] = useState(false)
  const restoreFocus = useRef(false)
  useEffect(() => {
    restoreFocus.current = false
    setOpen(false)
  }, [visible, taskId, transcriptEpoch])
  const summary = contextSummary({ steps, taskId, transcriptEpoch })
  if (!summary) return null
  return (
    <Popover.Root
      open={open && visible}
      onOpenChange={(next, event) => {
        restoreFocus.current =
          !next && !['outside-press', 'focus-out'].includes(event.reason)
        setOpen(next)
      }}
    >
      <Popover.Trigger
        render={
          <IconButton className="context-indicator" label="Context details">
            <CircleGauge size={16} aria-hidden />
          </IconButton>
        }
      />
      <Popover.Portal container={container}>
        <Popover.Positioner
          side="top"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="context-positioner"
        >
          <Popover.Popup
            className="context-popup"
            finalFocus={() => visible && restoreFocus.current}
          >
            <div className="context-popup-heading">
              <Popover.Title>Request context</Popover.Title>
              <Popover.Close
                render={
                  <IconButton label="Close context details">
                    <X size={16} aria-hidden />
                  </IconButton>
                }
              />
            </div>
            <RequestContextDetails summary={summary} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
