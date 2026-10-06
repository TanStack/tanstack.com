import {
  Children,
  isValidElement,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
  type ReactNode,
} from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { createPortal } from 'react-dom'
import { ArrowDown } from 'lucide-react'
import { ConversationMinimap, type MinimapArchive } from './ConversationMinimap'
import { IconButton } from './IconButton'
import {
  messageAnchorId,
  type ConversationNavigationItem,
} from '../core/message-navigation'
import './message-interactions.css'
import {
  createMessageFocusIntent,
  type MessageFocusIntent,
} from './message-focus'

export type ConversationNavigationHandle = {
  scrollToMessage: (
    messageId: string,
    options?: { focusIntent?: MessageFocusIntent | null },
  ) => boolean
  scrollToBottom: () => void
}

export function VirtualMessages({
  children,
  scrollElement,
  navigationItems = [],
  navigationRef,
  archive,
  onSelectMessage,
  onJumpToBottom,
  jumpToBottomContainer,
  contentVersion,
  messageScope,
}: {
  children: ReactNode
  scrollElement: HTMLDivElement | null
  navigationItems?: ConversationNavigationItem[]
  navigationRef?: Ref<ConversationNavigationHandle>
  archive?: MinimapArchive
  onSelectMessage?: (messageId: string) => void
  onJumpToBottom?: () => void
  jumpToBottomContainer?: HTMLDivElement | null
  contentVersion?: string | number
  messageScope?: string
}) {
  const rows = Children.toArray(children)
  const initialized = useRef(false)
  const listRef = useRef<HTMLDivElement>(null)
  const pendingTarget = useRef<string | undefined>(undefined)
  const pendingFocus = useRef<MessageFocusIntent | null>(null)
  const ownsPendingFocus = useRef(false)
  useLayoutEffect(
    () => () => {
      if (ownsPendingFocus.current) pendingFocus.current?.cancel()
    },
    [],
  )
  const [scrollMargin, setScrollMargin] = useState<number | null>(null)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const observedContent = useRef<string | undefined>(undefined)
  useLayoutEffect(() => {
    if (!scrollElement || !listRef.current) return
    const measure = () => {
      if (listRef.current)
        setScrollMargin(
          listRef.current.getBoundingClientRect().top -
            scrollElement.getBoundingClientRect().top +
            scrollElement.scrollTop,
        )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(scrollElement)
    return () => observer.disconnect()
  }, [scrollElement])
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    getItemKey: (index) => {
      const row = rows[index]
      return isValidElement(row) ? (row.key ?? index) : index
    },
    estimateSize: () => 160,
    overscan: 5,
    paddingStart: 25,
    paddingEnd: 15,
    anchorTo: 'end',
    followOnAppend: true,
    scrollEndThreshold: 48,
    scrollMargin: scrollMargin ?? 0,
  })
  useLayoutEffect(() => {
    if (
      !initialized.current &&
      scrollElement &&
      rows.length &&
      scrollMargin !== null
    ) {
      initialized.current = true
      virtualizer.scrollToEnd()
    }
  }, [rows.length, scrollElement, scrollMargin, virtualizer])

  const alignTarget = () => {
    if (!pendingTarget.current || !scrollElement) return
    if (pendingFocus.current && !pendingFocus.current.active()) {
      pendingTarget.current = undefined
      pendingFocus.current = null
      return
    }
    const element = scrollElement.querySelector<HTMLElement>(
      `#${CSS.escape(messageAnchorId(pendingTarget.current, messageScope))}`,
    )
    if (
      !element ||
      !scrollElement.contains(element) ||
      !element.getClientRects().length
    )
      return
    scrollElement.scrollTo({
      top:
        scrollElement.scrollTop +
        element.getBoundingClientRect().top -
        scrollElement.getBoundingClientRect().top -
        52,
      behavior: 'instant',
    })
    pendingFocus.current?.focus(element)
    pendingFocus.current = null
    pendingTarget.current = undefined
  }
  const scrollToMessage: ConversationNavigationHandle['scrollToMessage'] = (
    messageId,
    options,
  ) => {
    const item = navigationItems.find((item) =>
      item.messageIds.includes(messageId),
    )
    if (!item || !scrollElement) return false
    if (options?.focusIntent !== undefined && !options.focusIntent?.active())
      return true
    initialized.current = true
    if (pendingFocus.current !== options?.focusIntent)
      pendingFocus.current?.cancel()
    ownsPendingFocus.current = options?.focusIntent === undefined
    pendingFocus.current =
      options?.focusIntent === undefined
        ? createMessageFocusIntent()
        : options.focusIntent
    pendingTarget.current = messageId
    virtualizer.scrollToIndex(item.rowIndex, { align: 'start' })
    requestAnimationFrame(alignTarget)
    return true
  }
  const scrollToBottom = () => {
    initialized.current = true
    pendingTarget.current = undefined
    pendingFocus.current?.cancel()
    pendingFocus.current = null
    virtualizer.scrollToEnd()
  }
  useImperativeHandle(navigationRef, () => ({
    scrollToMessage,
    scrollToBottom,
  }))
  useLayoutEffect(() => {
    if (!pendingTarget.current) return
    const frame = requestAnimationFrame(alignTarget)
    return () => cancelAnimationFrame(frame)
  })
  const activeRow = virtualizer.range?.startIndex
  const showJump =
    !!scrollElement &&
    scrollElement.scrollHeight - scrollElement.clientHeight > 48 &&
    !virtualizer.isAtEnd()
  const contentSignature = JSON.stringify([
    contentVersion,
    navigationItems.map((item) => [
      item.id,
      item.messageIds,
      item.prompt,
      item.preview,
    ]),
  ])
  useLayoutEffect(() => {
    const changed =
      observedContent.current !== undefined &&
      observedContent.current !== contentSignature
    observedContent.current = contentSignature
    if (!scrollElement) return
    if (!showJump) setHasNewMessages(false)
    else if (changed) setHasNewMessages(true)
  }, [contentSignature, scrollElement, showJump])

  return (
    <>
      {showJump &&
        jumpToBottomContainer &&
        createPortal(
          <>
            <IconButton
              className="message-jump-to-latest"
              label={
                hasNewMessages
                  ? 'New messages, jump to latest'
                  : 'Jump to latest message'
              }
              onClick={(event) => {
                if (document.activeElement === event.currentTarget)
                  scrollElement?.focus({ preventScroll: true })
                scrollToBottom()
                onJumpToBottom?.()
              }}
            >
              <ArrowDown size={14} aria-hidden />
            </IconButton>
            <span className="message-sr-only" role="status">
              {hasNewMessages ? 'New messages' : ''}
            </span>
          </>,
          jumpToBottomContainer,
        )}
      <ConversationMinimap
        items={navigationItems}
        archive={archive}
        activeRow={activeRow}
        onSelect={(id) => {
          if (onSelectMessage) onSelectMessage(id)
          else scrollToMessage(id)
        }}
      />
      <div
        ref={listRef}
        className="message-list"
        style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((row) => (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className="virtual-message"
            style={{
              transform: `translateY(${row.start - (scrollMargin ?? 0)}px)`,
            }}
          >
            {rows[row.index]}
          </div>
        ))}
      </div>
    </>
  )
}
