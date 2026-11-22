import type { Approval } from '../core/types'
import { CodeBlock } from './MessageMarkdown'
import './workspace-review.css'

export function WorkspaceReview({ approval }: { approval: Approval }) {
  const review = approval.workspace!
  const operation = review.operation
  const state =
    approval.executionOutcome === 'unknown'
      ? 'Outcome unknown. Check the workspace before trying again.'
      : approval.status === 'pending'
        ? 'Waiting for approval.'
        : approval.status === 'running'
          ? 'Waiting for the workspace result…'
          : approval.status === 'rejected'
            ? 'Declined. Nothing was sent to the workspace.'
            : approval.status === 'done'
              ? operation.type === 'write_file'
                ? 'File written.'
                : 'Command completed.'
              : 'The operation failed. Check its result before trying again.'
  return (
    <div className="workspace-review">
      <p role={approval.status === 'error' ? 'alert' : 'status'}>{state}</p>
      {operation.type === 'write_file' ? (
        <>
          <dl>
            <div>
              <dt>File</dt>
              <dd>
                <code>{operation.path}</code>
              </dd>
            </div>
          </dl>
          {approval.status === 'pending' && (
            <p>
              Writes the complete file. Any existing contents will be replaced.
            </p>
          )}
          <div className="tool-detail-label">File contents</div>
          {operation.text === '' && <p>Empty file (0 bytes)</p>}
          <CodeBlock code={operation.text} lang="text" />
        </>
      ) : (
        <>
          <dl>
            <div>
              <dt>Command</dt>
              <dd>
                <code>{operation.command}</code>
              </dd>
            </div>
            <div>
              <dt>Directory</dt>
              <dd>
                <code>{operation.cwd}</code>
              </dd>
            </div>
            <div>
              <dt>Time limit</dt>
              <dd>{operation.timeoutMs} ms</dd>
            </div>
          </dl>
          <div className="tool-detail-label">Arguments</div>
          <CodeBlock
            code={JSON.stringify(operation.args, null, 2)}
            lang="json"
          />
        </>
      )}
      <details>
        <summary>Workspace session</summary>
        <CodeBlock
          code={JSON.stringify(
            {
              sessionId: review.sessionId,
              runtimeId: review.runtimeId,
              hostGeneration: review.hostGeneration,
              commandId: review.commandId,
            },
            null,
            2,
          )}
          lang="json"
        />
      </details>
    </div>
  )
}
