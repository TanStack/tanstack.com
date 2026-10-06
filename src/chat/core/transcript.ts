import type { UIMessage } from '@tanstack/ai'
import type { Approval } from './types'
import type { TurnOutcome } from './message-navigation'
import type { ToolReceipt } from './conversation-copy'

export interface ArchivedTurn {
  id: string
  messages: UIMessage[]
  approvals: Approval[]
  outcome?: TurnOutcome
  receipts?: ToolReceipt[]
  inherited?: { partial: boolean }
}
