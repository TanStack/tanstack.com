import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useWorkspaceApi } from './WorkspaceApi'
import type { ConversationDestination } from '../core/conversation-destination'

// A fetched or selected conversation is not necessarily being read. Advance
// only the version included in the rendered snapshot, when its end is visible.
export function useConversationRead(
  destination: ConversationDestination,
  element: HTMLDivElement | null,
  version: number | undefined,
  running: boolean,
  visible: boolean,
) {
  const { request, workspaceId } = useWorkspaceApi()
  const { conversationId, apiPath } = destination
  const client = useQueryClient()
  const acknowledged = useRef(0)
  useEffect(() => {
    acknowledged.current = 0
  }, [conversationId, workspaceId])
  useEffect(() => {
    if (!element || !version || running || !visible) return
    let pending = false
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    const check = async () => {
      if (
        disposed ||
        pending ||
        version <= acknowledged.current ||
        document.visibilityState !== 'visible' ||
        !element.getClientRects().length ||
        !document.hasFocus() ||
        document.querySelector('dialog[open]')
      )
        return
      if (element.scrollHeight - element.scrollTop - element.clientHeight > 48)
        return
      pending = true
      try {
        const result = await request<{ readVersion: number }>(
          `${apiPath}/read`,
          { version },
        )
        if (disposed) return
        acknowledged.current = Math.max(
          acknowledged.current,
          result.readVersion,
        )
        if (result.readVersion < version)
          timer = setTimeout(() => {
            void check()
          }, 2000)
        await client.invalidateQueries({
          queryKey: ['bot-activity', workspaceId],
        })
        await client.invalidateQueries({
          queryKey: ['conversation-threads', workspaceId],
        })
      } catch {
        // Keep the unread marker until the write succeeds. Retry only while
        // this version remains visible, including after a brief network error.
        if (!disposed)
          timer = setTimeout(() => {
            void check()
          }, 5000)
      } finally {
        pending = false
      }
    }
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void check()
      }, 200)
    }
    schedule()
    const resize = new ResizeObserver(schedule)
    resize.observe(element)
    element.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('focus', schedule)
    document.addEventListener('visibilitychange', schedule)
    document.addEventListener('focusin', schedule)
    document.addEventListener('close', schedule, true)
    return () => {
      disposed = true
      clearTimeout(timer)
      resize.disconnect()
      element.removeEventListener('scroll', schedule)
      window.removeEventListener('focus', schedule)
      document.removeEventListener('visibilitychange', schedule)
      document.removeEventListener('focusin', schedule)
      document.removeEventListener('close', schedule, true)
    }
  }, [
    conversationId,
    apiPath,
    element,
    version,
    running,
    visible,
    request,
    workspaceId,
    client,
  ])
}
