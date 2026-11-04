import { motion } from 'motion/react'
import { useUiTransition } from './ui/motion'
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import { Menu } from '@base-ui/react/menu'
import { Collapsible } from '@base-ui/react/collapsible'
import { Tabs } from '@base-ui/react/tabs'
import { Maximize2, Minimize2, Plus, RotateCcw, X } from 'lucide-react'
import { IconButton } from './IconButton'
import { usePanelMotion } from './usePanelMotion'
import {
  workspacePanelIds,
  availableWorkspacePanels,
  isPanelId,
  readFilePanel,
  maxWorkspacePanels,
  type BuiltinPanelId,
  type PanelId,
  type WorkspacePanelState,
} from '../core/workspace-panels'
import './conversation-workspace.css'

const panelNames: Record<BuiltinPanelId, string> = {
  summary: 'Details',
  usage: 'Usage',
  activity: 'Activity',
  files: 'Files',
  projects: 'Projects',
  schedules: 'Schedules',
  memory: 'Memory',
  mail: 'Mail',
  commands: 'Commands',
  preview: 'Preview',
  browser: 'Browser',
}
const defaultWidth = 380
const minPane = 280
const minConversation = 360
const dividerWidth = 8

export function ConversationWorkspace({
  state,
  storageKey,
  onOpen,
  onClose,
  onClosePane,
  onFullscreen,
  returnFocus,
  renderPanel,
  getPanelName,
  focusActiveTab = true,
  availablePanels = availableWorkspacePanels(),
  children,
}: {
  state: WorkspacePanelState
  focusActiveTab?: boolean
  availablePanels?: readonly BuiltinPanelId[]
  storageKey: string
  onOpen: (id: PanelId) => void
  onClose: (id: PanelId) => void
  onClosePane: () => void
  onFullscreen: () => void
  returnFocus: RefObject<HTMLButtonElement | null>
  renderPanel: (id: PanelId) => ReactNode
  getPanelName?: (id: PanelId) => string | undefined
  children: ReactNode
}) {
  const visible = !!state.active && !state.hidden
  const tabTransition = useUiTransition(0.12)
  const animate = usePanelMotion(
    storageKey,
    `${visible}:${state.active ?? ''}:${!!state.fullscreen}`,
  )
  const container = useRef<HTMLDivElement>(null)
  const name = (id: PanelId) =>
    getPanelName?.(id) ||
    (id === 'thread'
      ? 'Thread'
      : readFilePanel(id)?.kind === 'diff'
        ? 'Compare files'
        : readFilePanel(id)?.kind === 'source'
          ? 'Source'
          : readFilePanel(id)
            ? 'File'
            : panelNames[id as BuiltinPanelId])
  const activeTab = useRef<HTMLElement | null>(null)
  const moveFocus = useRef(false)
  const menuSelection = useRef(false)
  const panelAvailable = (id: PanelId) =>
    id !== 'summary' &&
    (!workspacePanelIds.includes(id as BuiltinPanelId) ||
      availablePanels.includes(id as BuiltinPanelId))
  const previousActive = useRef(state.active)
  const [availableWidth, setAvailableWidth] = useState(0)
  const [saved, setSaved] = useState<{
    key: string
    width: number
    closed: PanelId[]
  }>({ key: '', width: defaultWidth, closed: [] })
  const preferredWidth = saved.key === storageKey ? saved.width : defaultWidth
  const closed = saved.key === storageKey ? saved.closed : []
  const maxPane = Math.max(
    minPane,
    Math.min(1600, availableWidth - minConversation - dividerWidth),
  )
  const paneWidth = Math.min(maxPane, Math.max(minPane, preferredWidth))
  const narrow =
    availableWidth > 0 &&
    availableWidth < minPane + minConversation + dividerWidth
  const paneOnly = visible && (state.fullscreen || narrow)
  // Retain the last open tabs while Base UI finishes the exit transition.
  // Never carry that snapshot across conversation/workspace identities.
  const [retained, setRetained] = useState({ key: storageKey, state })
  if (
    state.active &&
    (retained.key !== storageKey ||
      retained.state.active !== state.active ||
      retained.state.fullscreen !== state.fullscreen ||
      retained.state.tabs.join(',') !== state.tabs.join(','))
  ) {
    setRetained({ key: storageKey, state })
  }
  const paneState =
    state.active || retained.key !== storageKey ? state : retained.state
  const displayedPaneOnly =
    !!paneState.active && (paneState.fullscreen || narrow)
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(
    null,
  )
  const [resizing, setResizing] = useState(false)

  useLayoutEffect(() => {
    let width = defaultWidth
    let closed: PanelId[] = []
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
      if (Number.isFinite(stored?.width))
        width = Math.min(1600, Math.max(minPane, stored.width))
      if (Array.isArray(stored?.closed))
        closed = [...new Set<PanelId>(stored.closed.filter(isPanelId))].slice(
          -maxWorkspacePanels,
        )
    } catch {}
    setSaved({ key: storageKey, width, closed })
  }, [storageKey])
  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    // Resolve the restored pane width and narrow layout before the first paint.
    setAvailableWidth(element.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) =>
      setAvailableWidth(entry.contentRect.width),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if ((state.active && !previousActive.current) || moveFocus.current) {
      if (visible) {
        if (focusActiveTab) activeTab.current?.focus()
      } else returnFocus.current?.focus()
      moveFocus.current = false
    }
    previousActive.current = state.active
  }, [state.active, visible, state.tabs.join(','), returnFocus, focusActiveTab])
  useEffect(() => {
    // External file links and library selections can open a tab beyond the
    // visible strip. Reveal it without changing Base UI's focus registration.
    activeTab.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [state.active, availableWidth])

  const persist = (width: number, recentlyClosed = closed) => {
    setSaved({ key: storageKey, width, closed: recentlyClosed })
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ width, closed: recentlyClosed }),
      )
    } catch {}
  }
  const open = (id: PanelId) => {
    if (!panelAvailable(id)) return
    menuSelection.current = true
    persist(
      preferredWidth,
      closed.filter((item) => item !== id),
    )
    onOpen(id)
  }
  const close = (id: PanelId) => {
    moveFocus.current = true
    persist(
      preferredWidth,
      [...closed.filter((item) => item !== id), id].slice(-maxWorkspacePanels),
    )
    onClose(id)
  }
  const closePane = () => {
    moveFocus.current = true
    onClosePane()
  }
  const reopen = [...closed]
    .reverse()
    .find(
      (id) =>
        panelAvailable(id) &&
        !state.tabs.includes(id) &&
        (!(readFilePanel(id) || id === 'thread') ||
          !getPanelName ||
          Boolean(getPanelName(id))),
    )

  return (
    <Collapsible.Root
      open={visible}
      ref={container}
      className={`conversation-layout conversation-workspace${resizing ? ' is-resizing' : ''}`}
      data-panel-motion={animate || undefined}
      data-pane-only={displayedPaneOnly || undefined}
      style={{ '--details-width': `${paneWidth}px` } as CSSProperties}
    >
      <div
        className="workspace-conversation"
        aria-hidden={paneOnly || undefined}
        inert={paneOnly}
      >
        {children}
      </div>
      <Collapsible.Panel
        keepMounted
        className="workspace-pane-presence"
        inert={!visible}
        aria-hidden={!visible || undefined}
      >
        {!displayedPaneOnly && (
          <div
            className="workspace-separator"
            role="separator"
            tabIndex={0}
            aria-label="Resize side panel"
            aria-orientation="vertical"
            aria-controls="conversation-details-pane"
            aria-valuemin={minPane}
            aria-valuemax={Math.round(maxPane)}
            aria-valuenow={Math.round(paneWidth)}
            aria-valuetext={`${Math.round(paneWidth)} pixels wide`}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.currentTarget.focus()
              event.currentTarget.setPointerCapture(event.pointerId)
              drag.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                width: paneWidth,
              }
              setResizing(true)
            }}
            onPointerMove={(event) => {
              const start = drag.current
              if (!start || start.pointerId !== event.pointerId) return
              const width = Math.min(
                maxPane,
                Math.max(minPane, start.width + start.x - event.clientX),
              )
              setSaved({ key: storageKey, width, closed })
            }}
            onPointerUp={(event) => {
              const start = drag.current
              if (!start || start.pointerId !== event.pointerId) return
              drag.current = null
              setResizing(false)
              persist(
                Math.min(
                  maxPane,
                  Math.max(minPane, start.width + start.x - event.clientX),
                ),
              )
              event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onLostPointerCapture={() => {
              if (drag.current) {
                setSaved({
                  key: storageKey,
                  width: drag.current.width,
                  closed,
                })
                drag.current = null
                setResizing(false)
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && drag.current) {
                const pointerId = drag.current.pointerId
                persist(drag.current.width)
                drag.current = null
                setResizing(false)
                if (event.currentTarget.hasPointerCapture(pointerId))
                  event.currentTarget.releasePointerCapture(pointerId)
              } else {
                const delta = event.shiftKey ? 64 : 16
                const width =
                  event.key === 'ArrowLeft'
                    ? paneWidth + delta
                    : event.key === 'ArrowRight'
                      ? paneWidth - delta
                      : event.key === 'Home'
                        ? minPane
                        : event.key === 'End'
                          ? maxPane
                          : undefined
                if (width === undefined) return
                event.preventDefault()
                persist(Math.min(maxPane, Math.max(minPane, width)))
              }
            }}
          />
        )}
        <aside
          id="conversation-details-pane"
          className="workspace-pane"
          aria-label="Side Panel"
        >
          <Tabs.Root
            value={paneState.active}
            onValueChange={(value) => {
              // Programmatic focus can report the already-selected tab. It
              // must not create another history entry or reopen an exiting pane.
              if (state.active && value !== state.active && isPanelId(value))
                onOpen(value)
            }}
            className="workspace-tabs-root"
          >
            <div className="workspace-pane-toolbar">
              <Tabs.List
                activateOnFocus
                className="workspace-tabs"
                aria-label="Side Panel tabs"
              >
                {paneState.tabs.map((id) => (
                  <div
                    className="workspace-tab-item"
                    key={id}
                    data-active={paneState.active === id || undefined}
                  >
                    <Tabs.Tab
                      value={id}
                      ref={paneState.active === id ? activeTab : undefined}
                      className="workspace-tab"
                      onKeyDown={(event) => {
                        if (event.key === 'Delete') {
                          event.preventDefault()
                          close(id)
                        }
                      }}
                    >
                      <span
                        title={name(id)}
                        style={{
                          display: 'block',
                          maxWidth: 160,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {name(id)}
                      </span>
                    </Tabs.Tab>
                    <IconButton
                      label={`Close ${name(id)} tab`}
                      onClick={() => close(id)}
                    >
                      <X size={12} aria-hidden />
                    </IconButton>
                  </div>
                ))}
              </Tabs.List>
              <div className="workspace-pane-actions">
                <Menu.Root>
                  <Menu.Trigger
                    render={
                      <IconButton label="Open side panel tab">
                        <Plus size={16} aria-hidden />
                      </IconButton>
                    }
                  />
                  <Menu.Portal>
                    <Menu.Positioner
                      className="bw-positioner"
                      align="end"
                      sideOffset={6}
                    >
                      <Menu.Popup
                        className="bw-menu"
                        finalFocus={() => {
                          if (!menuSelection.current) return true
                          menuSelection.current = false
                          return activeTab.current
                        }}
                      >
                        {availablePanels
                          .filter((id) => id !== 'summary')
                          .map((id) => (
                            <Menu.Item
                              className="bw-menu-item"
                              key={id}
                              onClick={() => open(id)}
                            >
                              {panelNames[id]}
                            </Menu.Item>
                          ))}
                        {reopen && (
                          <>
                            <Menu.Separator className="bw-menu-separator" />
                            <Menu.Item
                              className="bw-menu-item"
                              onClick={() => open(reopen)}
                            >
                              <RotateCcw size={14} aria-hidden />
                              <span
                                style={{
                                  minWidth: 0,
                                  maxWidth: 220,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                Reopen {name(reopen)}
                              </span>
                            </Menu.Item>
                          </>
                        )}
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
                {!narrow && (
                  <IconButton
                    label={
                      paneState.fullscreen
                        ? 'Exit pane fullscreen'
                        : 'Expand pane'
                    }
                    onClick={onFullscreen}
                  >
                    {paneState.fullscreen ? (
                      <Minimize2 size={15} aria-hidden />
                    ) : (
                      <Maximize2 size={15} aria-hidden />
                    )}
                  </IconButton>
                )}
                <IconButton
                  label={
                    displayedPaneOnly
                      ? 'Back to conversation'
                      : 'Hide side panel'
                  }
                  onClick={closePane}
                >
                  <X size={16} aria-hidden />
                </IconButton>
              </div>
            </div>
            {paneState.tabs.map((id) => (
              <Tabs.Panel
                render={
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: paneState.active === id ? 1 : 0 }}
                    transition={tabTransition}
                  />
                }
                value={id}
                key={id}
                keepMounted={
                  id === 'files' ||
                  id === 'projects' ||
                  id === 'thread' ||
                  id === 'commands' ||
                  id === 'preview'
                }
                className={`workspace-tab-panel${id === 'thread' ? ' workspace-thread-panel' : ''}`}
              >
                {renderPanel(id)}
              </Tabs.Panel>
            ))}
          </Tabs.Root>
        </aside>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
