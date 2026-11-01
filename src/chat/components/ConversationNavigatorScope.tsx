import { LayoutGroup, MotionConfig } from 'motion/react'
import { layoutTransition } from './ui/motion'
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import type { WorkspaceBot } from '../core/bot-workspace'
import type { ThreadListItem } from '../core/conversation-threads'
import { conversationFamily } from '../core/conversation-family'
import { useWorkspaceApi } from './WorkspaceApi'
import type { ConversationDestination } from '../core/conversation-destination'
import type { ThreadOpenIntent } from './ConversationThreads'

type Layout = { wide: boolean; dockOverride?: boolean }
type NavigatorSession = {
  destination: ConversationDestination
  onOpenThread?: (thread: ThreadListItem, intent?: ThreadOpenIntent) => void
}
const ScopeContext = createContext<{
  family: ReturnType<typeof conversationFamily>
  threads: ReturnType<typeof useFamilyThreads>
  selectedThreads: ReturnType<typeof useFamilyThreads>
  selected: WorkspaceBot
  userId: string
  session: RefObject<NavigatorSession | null>
  threadOpenAttempt: RefObject<number>
  navigationDepth: RefObject<number | null>
  layout: Layout
  setLayout: Dispatch<SetStateAction<Layout>>
  overlayOpen: boolean
  setOverlayOpen: Dispatch<SetStateAction<boolean>>
} | null>(null)

function useFamilyThreads(root: WorkspaceBot, userId: string, enabled = true) {
  const { request } = useWorkspaceApi()
  return useQuery({
    queryKey: [
      'conversation-threads',
      root.workspace_id,
      userId,
      root.mainConversationId ?? root.id,
    ],
    queryFn: () =>
      request<{ items: ThreadListItem[] }>(
        `conversations/${encodeURIComponent(root.mainConversationId!)}/threads`,
      ),
    enabled: enabled && !!root.mainConversationId,
    retry: false,
    staleTime: 0,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  })
}

/** Outlives each keyed conversation session, without sharing its messages or composer. */
export function ConversationNavigatorScope({
  selected,
  bots,
  userId,
  children,
}: {
  selected: WorkspaceBot
  bots: WorkspaceBot[]
  userId: string
  children: ReactNode
}) {
  const family = conversationFamily(selected, bots)
  return (
    <FamilyScope
      key={JSON.stringify([userId, family.root.workspace_id, family.root.id])}
      family={family}
      selected={selected}
      userId={userId}
    >
      {children}
    </FamilyScope>
  )
}

function FamilyScope({
  family,
  selected,
  userId,
  children,
}: {
  family: ReturnType<typeof conversationFamily>
  selected: WorkspaceBot
  userId: string
  children: ReactNode
}) {
  const threads = useFamilyThreads(family.root, userId)
  const selectedThreads = useFamilyThreads(
    selected,
    userId,
    selected.id !== family.root.id,
  )
  const session = useRef<NavigatorSession | null>(null)
  const threadOpenAttempt = useRef(0)
  const navigationDepth = useRef<number | null>(null)
  const [layout, setLayout] = useState<Layout>({ wide: false })
  const [overlayOpen, setOverlayOpen] = useState(false)
  return (
    <ScopeContext
      value={{
        family,
        threads,
        selectedThreads,
        selected,
        userId,
        session,
        threadOpenAttempt,
        navigationDepth,
        layout,
        setLayout,
        overlayOpen,
        setOverlayOpen,
      }}
    >
      <MotionConfig reducedMotion="user" transition={layoutTransition}>
        <LayoutGroup
          id={JSON.stringify([
            userId,
            family.root.workspace_id,
            family.root.id,
          ])}
        >
          {children}
        </LayoutGroup>
      </MotionConfig>
    </ScopeContext>
  )
}

export function useConversationNavigatorScope() {
  const scope = useContext(ScopeContext)
  if (!scope)
    throw new Error('Conversation navigation requires a family scope.')
  return scope
}

/** Only the authorized, currently mounted session can open its embedded thread. */
export function useConversationNavigatorSession(
  destination: ConversationDestination,
  onOpenThread: NavigatorSession['onOpenThread'],
  enabled: boolean,
) {
  const scope = useContext(ScopeContext)
  const sessionRef = scope?.session
  useLayoutEffect(() => {
    if (!sessionRef || !enabled) return
    const session = { destination, onOpenThread }
    sessionRef.current = session
    return () => {
      if (sessionRef.current === session) sessionRef.current = null
    }
  }, [sessionRef, destination, onOpenThread, enabled])
}
