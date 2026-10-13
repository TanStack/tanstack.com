import { LoadingState } from './ui/LoadingState'
import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Popover } from '@base-ui/react/popover'
import { List, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ConversationDestination } from '../core/conversation-destination'
import type { ConversationNavigationItem } from '../core/message-navigation'
import type { TranscriptNavigationPage } from '../core/transcript-navigation'
import { IconButton } from './IconButton'
import { useWorkspaceApi } from './WorkspaceApi'

export type MinimapArchive = {
  destination: ConversationDestination
  count: number
  epoch?: string
}

export function ConversationMinimap({
  items,
  archive,
  activeRow,
  onSelect,
}: {
  items: ConversationNavigationItem[]
  archive?: MinimapArchive
  activeRow?: number
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const selected = useRef(false)
  if (items.length + (archive?.count ?? 0) < 2) return null
  return (
    <div className="message-navigation">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <div className="message-navigation-tools">
          <Popover.Trigger
            ref={trigger}
            render={
              <IconButton
                label="Conversation minimap"
                className="message-navigation-button"
              >
                <List size={15} aria-hidden />
              </IconButton>
            }
          />
        </div>
        <Popover.Portal>
          <Popover.Positioner
            side="bottom"
            align="end"
            sideOffset={6}
            collisionPadding={12}
            className="message-minimap-positioner"
          >
            <Popover.Popup
              className="message-minimap"
              finalFocus={() => {
                const moved = selected.current
                selected.current = false
                return moved ? false : trigger.current
              }}
            >
              <Popover.Title className="sr-only">
                Conversation minimap
              </Popover.Title>
              <MinimapPage
                key={`${archive?.destination.sessionKey}:${archive?.epoch}`}
                items={items}
                archive={archive}
                activeRow={activeRow}
                onSelect={(id) => {
                  selected.current = true
                  // The archive dialog can restore focus to this stable opener.
                  trigger.current?.focus({ preventScroll: true })
                  setOpen(false)
                  onSelect(id)
                }}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

function MinimapPage({
  items,
  archive,
  activeRow,
  onSelect,
}: {
  items: ConversationNavigationItem[]
  archive?: MinimapArchive
  activeRow?: number
  onSelect: (id: string) => void
}) {
  const { request } = useWorkspaceApi()
  const [hasPaged, setHasPaged] = useState(false)
  const [cursors, setCursors] = useState<
    Array<{ before?: number; epoch?: string }>
  >([{ epoch: archive?.epoch }])
  const cursor = cursors.at(-1)!
  const query = useQuery({
    queryKey: [
      'transcript-navigation',
      archive?.destination.sessionKey,
      archive?.count,
      archive?.epoch,
      cursor,
    ],
    enabled: !!archive?.count,
    queryFn: ({ signal }) => {
      const params = new URLSearchParams()
      if (cursor.before !== undefined)
        params.set('before', String(cursor.before))
      if (cursor.epoch) params.set('epoch', cursor.epoch)
      return request<TranscriptNavigationPage>(
        `${archive!.destination.apiPath}/navigation?${params}`,
        undefined,
        'GET',
        { signal },
      )
    },
    retry: false,
    staleTime: 0,
  })
  // Retained query data is never displayed after a failed authorization refresh.
  const page = !query.error && !query.isFetching ? query.data : undefined
  const firstPage = cursors.length === 1
  const rows = [
    ...(page?.items ?? [])
      .filter((item) => !items.some((live) => live.id === item.id))
      .map((item, index) => ({
        ...item,
        ordinal: page!.startIndex + index + 1,
        active: false,
      })),
    ...(firstPage
      ? items.map((item, index) => ({
          ...item,
          ordinal: (page?.total ?? archive?.count ?? 0) + index + 1,
          active: item.rowIndex === activeRow,
        }))
      : []),
  ]
  const loading = !!archive?.count && (query.isPending || query.isFetching)
  return (
    <nav aria-label="Conversation minimap">
      <div className="message-minimap-list" aria-busy={loading}>
        {loading && <LoadingState>Loading earlier messages…</LoadingState>}
        {query.error && (
          <p role="alert">
            {query.error.message}{' '}
            <button
              className="quiet-button"
              onClick={() => {
                if (cursors.length > 1) setCursors([{ epoch: archive?.epoch }])
                else void query.refetch()
              }}
            >
              Retry
            </button>
          </p>
        )}
        <ol>
          {rows.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={item.active ? 'location' : undefined}
                onClick={() => onSelect(item.id)}
              >
                <span className="message-minimap-number" aria-hidden>
                  {item.ordinal}
                </span>
                <span>
                  <strong>{item.prompt || `Response ${item.ordinal}`}</strong>
                  {item.preview && (
                    <span className="message-minimap-preview">
                      {item.preview}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      {(!!page?.nextBefore || hasPaged || !firstPage) && (
        <div className="message-minimap-pages">
          <IconButton
            label="Older messages"
            disabled={loading || !page?.nextBefore}
            onClick={() => {
              if (page?.nextBefore) {
                setHasPaged(true)
                setCursors((old) => [
                  ...old,
                  { before: page.nextBefore!, epoch: page.epoch },
                ])
              }
            }}
          >
            <ChevronLeft size={16} aria-hidden />
          </IconButton>
          <IconButton
            label="Newer messages"
            disabled={loading || firstPage}
            onClick={() => setCursors((old) => old.slice(0, -1))}
          >
            <ChevronRight size={16} aria-hidden />
          </IconButton>
        </div>
      )}
    </nav>
  )
}
