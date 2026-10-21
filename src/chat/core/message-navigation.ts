import type { UIMessage } from '@tanstack/ai'
import { parseMarkdown } from '@tanstack/markdown/parser'
import type { BlockNode, InlineNode } from '@tanstack/markdown'
import { readMessageAttachments } from './message-attachments'

export type ConversationGroup = {
  id: string
  prompt?: UIMessage
  responses: UIMessage[]
}

export type TurnOutcome = {
  status: 'done' | 'waiting' | 'error'
  reason?: string
  termination?: 'incomplete' | 'interrupted'
  answerId?: string
  startedAt?: number
  completedAt?: number
}

export type ConversationNavigationItem = {
  id: string
  messageIds: string[]
  rowIndex: number
  prompt: string
  preview: string
}

export function messageAnchorId(id: string, scope?: string) {
  return scope
    ? `message-scope-${encodeURIComponent(JSON.stringify([scope, id]))}`
    : `message-${encodeURIComponent(id)}`
}

export function messageText(message?: UIMessage) {
  return (
    message?.parts
      .flatMap((part) => (part.type === 'text' ? [part.content] : []))
      .join('\n\n') ?? ''
  )
}

export function finalResponse(turn: ConversationGroup, outcome?: TurnOutcome) {
  if (outcome && outcome.status !== 'done') return undefined
  const responses = turn.responses.filter((message) =>
    messageText(message).trim(),
  )
  return outcome
    ? responses.find((message) => message.id === outcome.answerId)
    : responses.at(-1)
}

export function finalResponseParts(message?: UIMessage) {
  const lastTool =
    message?.parts.reduce(
      (last, part, index) =>
        part.type === 'tool-call' || part.type === 'tool-result' ? index : last,
      -1,
    ) ?? -1
  return { lastTool, parts: message?.parts.slice(lastTool + 1) ?? [] }
}

/** Use the same safe Markdown parser as the renderer, without copying UI labels. */
export function markdownText(source: string, includeLinks = false) {
  const inline = (nodes: InlineNode[]): string =>
    nodes
      .map((node): string => {
        switch (node.type) {
          case 'text':
          case 'inlineCode':
          case 'inlineHtml':
            return node.value
          case 'image':
            return node.alt
          case 'break':
            return '\n'
          case 'footnoteReference':
            return `[${node.number}]`
          case 'link':
            return (
              inline(node.children) +
              (includeLinks && node.href ? ` (${node.href})` : '')
            )
          default:
            return inline(node.children)
        }
      })
      .join('')
  const blocks = (nodes: BlockNode[]): string =>
    nodes
      .map((node): string => {
        switch (node.type) {
          case 'heading':
          case 'paragraph':
            return inline(node.children)
          case 'code':
          case 'html':
            return node.value
          case 'thematicBreak':
            return ''
          case 'list':
            return node.items
              .map(
                (item, index) =>
                  `${node.ordered ? `${(node.start ?? 1) + index}.` : '•'} ${item.checked === undefined ? '' : item.checked ? '[x] ' : '[ ] '}${blocks(item.children)}`,
              )
              .join('\n')
          case 'table':
            return [node.header, ...node.rows]
              .map((row) => row.map((cell) => inline(cell.children)).join('\t'))
              .join('\n')
          case 'footnotes':
            return node.items
              .map((item) => `[${item.number}] ${blocks(item.children)}`)
              .join('\n')
          case 'callout':
            return [node.title, blocks(node.children)]
              .filter(Boolean)
              .join('\n')
          default:
            return blocks(node.children)
        }
      })
      .join('\n\n')
  return blocks(parseMarkdown(source, { allowHtml: false }).children)
}

function previewText(source: string) {
  const text = markdownText(source).replace(/\s+/g, ' ').trim()
  return text.length > 180 ? `${text.slice(0, 177)}…` : text
}

export function buildConversationNavigation(
  turns: ConversationGroup[],
  outcomes?: Record<string, TurnOutcome>,
  runningTurnId?: string,
  inheritedTurns?: Record<string, { partial: boolean }>,
): ConversationNavigationItem[] {
  return turns.map((turn, rowIndex) => {
    const final =
      turn.id === runningTurnId || inheritedTurns?.[turn.id]?.partial
        ? undefined
        : finalResponse(turn, outcomes?.[turn.id])
    return {
      id: turn.id,
      messageIds: [
        ...new Set([turn.id, ...turn.responses.map((message) => message.id)]),
      ],
      rowIndex,
      prompt:
        previewText(messageText(turn.prompt)) ||
        readMessageAttachments(turn.prompt)
          .map((file) => file.name)
          .join(', '),
      preview: previewText(
        final
          ? messageText({ ...final, parts: finalResponseParts(final).parts })
          : '',
      ),
    }
  })
}

/** Missing, invalid, or reversed timestamps must never become a guessed duration. */
export function turnDurationMs(
  outcome?: Pick<TurnOutcome, 'startedAt' | 'completedAt'>,
  now?: number,
) {
  const start = outcome?.startedAt
  const end = outcome?.completedAt ?? now
  if (
    start === undefined ||
    end === undefined ||
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start
  )
    return undefined
  return end - start
}

export function formatTurnDuration(milliseconds: number) {
  if (milliseconds < 1000) return '<1s'
  const seconds = Math.floor(milliseconds / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
