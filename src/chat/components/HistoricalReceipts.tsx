import type { ToolReceipt } from '../core/conversation-copy'
import { CodeBlock } from './MessageMarkdown'

export function historicalReceiptStatus(receipt: ToolReceipt) {
  if (receipt.executionOutcome === 'unknown' || receipt.status === 'running')
    return 'Historical, outcome unconfirmed'
  return {
    pending: 'Historical, not executed',
    done: 'Historical, executed',
    rejected: 'Historical, declined',
    error: 'Historical, failed',
  }[receipt.status]
}

export function HistoricalReceipts({ receipts }: { receipts: ToolReceipt[] }) {
  return receipts.map((receipt) => (
    <details className="tool-call" key={receipt.id}>
      <summary>
        <span className="tool-label">{receipt.title}</span>
        <span className="tool-status">{historicalReceiptStatus(receipt)}</span>
      </summary>
      <div className="tool-details">
        {receipt.code && <CodeBlock code={receipt.code} lang="typescript" />}
        {receipt.result && <CodeBlock code={receipt.result} lang="json" />}
      </div>
    </details>
  ))
}
