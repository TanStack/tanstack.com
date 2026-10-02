import { modelPalettePage } from './model-palette'
import { useRef } from 'react'
import type { UIMessage } from '@tanstack/ai'
import type { SavedFile } from '../core/files'
import type { ThreadListItem } from '../core/conversation-threads'
import type { RunModelSelection } from '../core/run-model'
import { messageText, markdownText } from '../core/message-navigation'
import { usePaletteScope } from './palette-context'
import type { PaletteItem } from './palette-types'
import type { SessionWorkspace } from './ConversationSession'
import type { RunModelController } from './useRunModel'
import {
  availableWorkspacePanels,
  type BuiltinPanelId,
} from '../core/workspace-panels'

type Props = {
  id: string
  name: string
  available: boolean
  readOnly: boolean
  locked: boolean
  busy: boolean
  messages: UIMessage[]
  files: SavedFile[]
  threads: ThreadListItem[]
  workspace?: SessionWorkspace
  availablePanels?: readonly BuiltinPanelId[]
  model: RunModelController
  onStop: () => Promise<void>
  onCompose: () => void
  onReset: () => void
  onMessage: (id: string) => void
  messageLink: (id: string) => string
  onFork?: (id: string) => void
  onFile: (id: string) => void
  onThread?: (thread: ThreadListItem) => void
}

export function useConversationPalette(props: Props) {
  const current = useRef(props)
  current.current = props
  const { id, name, workspace, model } = props
  const action = (
    key: string,
    label: string,
    run: PaletteItem['run'],
    extra: Partial<PaletteItem> = {},
  ): PaletteItem => ({
    id: `${id}:${key}`,
    label,
    kind: 'action',
    detail: name,
    run,
    ...extra,
  })
  const chooseModel = (selection: RunModelSelection) => {
    if (
      !current.current.available ||
      current.current.readOnly ||
      current.current.locked ||
      !current.current.model.select(selection)
    )
      throw new Error(
        'This model choice could not be saved. Reopen the model picker and try again.',
      )
  }
  const modelPage = () => modelPalettePage(name, model, chooseModel)
  const messageItems = props.messages.flatMap((message): PaletteItem[] => {
    const text = messageText(message)
    if (!text.trim()) return []
    const label = markdownText(text.slice(0, 240))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 110)
    return [
      {
        id: `${id}:message:${message.id}`,
        label,
        kind: 'message',
        icon: 'chat',
        detail: `${message.role === 'user' ? 'You' : name} · Loaded message`,
        keywords: [text],
        afterClose: true,
        run: () => props.onMessage(message.id),
        actions: () => ({
          type: 'list',
          title: label,
          items: [
            action(
              `message:open:${message.id}`,
              'Go to message',
              () => props.onMessage(message.id),
              { afterClose: true, icon: 'arrow' },
            ),
            action(
              `message:copy:${message.id}`,
              'Copy message',
              () => navigator.clipboard.writeText(text),
              { icon: 'copy' },
            ),
            action(
              `message:link:${message.id}`,
              'Copy message link',
              () =>
                navigator.clipboard.writeText(props.messageLink(message.id)),
              { icon: 'copy' },
            ),
            ...(props.onFork
              ? [
                  action(
                    `message:fork:${message.id}`,
                    'Fork from this message…',
                    () => current.current.onFork?.(message.id),
                    { afterClose: true, icon: 'fork' },
                  ),
                ]
              : []),
          ],
        }),
      },
    ]
  })
  const items: PaletteItem[] = [
    ...(!props.readOnly
      ? [
          action(
            'compose',
            'Write a message',
            () => current.current.onCompose(),
            {
              icon: 'chat',
              afterClose: true,
              keywords: ['composer', 'focus', 'reply'],
              suggested: true,
            },
          ),
        ]
      : []),
    ...(props.busy
      ? [
          action('stop', 'Stop response', () => current.current.onStop(), {
            icon: 'stop',
            suggested: true,
            keywords: ['cancel', 'abort'],
          }),
        ]
      : []),
    ...(!props.readOnly
      ? [
          action('model', 'Change model…', modelPage, {
            kind: 'setting',
            icon: 'model',
            detail: `${name} · ${model.choice?.label ?? 'Model'}`,
            keywords: ['reasoning', 'effort', 'llm', 'provider'],
            disabledReason: props.locked
              ? 'Finish the pending send first'
              : !model.catalogReady
                ? 'Model choices are not ready yet'
                : undefined,
          }),
        ]
      : []),
    ...(workspace
      ? (
          [
            ['files', 'Files', ['attachments', 'documents']],
            ['usage', 'Usage', ['cost', 'spend', 'tokens']],
            ['activity', 'Activity', ['tools', 'thinking', 'trace']],
            ['memory', 'Memory', ['saved facts', 'kody']],
            ['mail', 'Mail', ['email', 'inbox', 'kody']],
            [
              'schedules',
              'Schedules',
              ['recurring', 'automations', 'reminders'],
            ],
            ['summary', 'Conversation details', ['summary', 'information']],
            ['commands', 'Commands', ['run', 'process', 'output']],
            ['preview', 'Preview', ['workspace preview', 'inspect']],
            ['browser', 'Browser', ['website', 'navigate', 'page']],
          ] as const
        )
          .filter(
            ([panel]) =>
              (props.availablePanels ?? availableWorkspacePanels()).includes(
                panel,
              ) &&
              (!props.readOnly ||
                (panel !== 'commands' && panel !== 'preview')),
          )
          .map(([panel, label, keywords]) =>
            action(
              `panel:${panel}`,
              label,
              () => {
                const latest = current.current
                if (
                  !latest.available ||
                  !(
                    latest.availablePanels ?? availableWorkspacePanels()
                  ).includes(panel) ||
                  (latest.readOnly &&
                    (panel === 'commands' || panel === 'preview'))
                )
                  return
                latest.workspace?.onOpen(panel)
              },
              {
                afterClose: true,
                icon: panel === 'files' ? 'file' : 'layout',
                keywords: [...keywords],
              },
            ),
          )
      : []),
    ...(workspace?.state.active
      ? [
          action(
            'close-pane',
            'Close side panel',
            () => current.current.workspace?.onClosePane(),
            { afterClose: true, icon: 'layout' },
          ),
          action(
            'expand-pane',
            workspace.state.fullscreen
              ? 'Restore side panel'
              : 'Expand side panel',
            () => current.current.workspace?.onFullscreen(),
            { afterClose: true, icon: 'layout', keywords: ['fullscreen'] },
          ),
        ]
      : []),
    ...(!props.readOnly && !props.busy && !props.locked
      ? [
          action('fresh', 'Start fresh…', () => current.current.onReset(), {
            afterClose: true,
            keywords: ['reset', 'clear', 'history'],
          }),
        ]
      : []),
    ...props.files
      .filter((file) => file.state === 'ready')
      .map(
        (file): PaletteItem => ({
          id: `${id}:file:${file.id}`,
          label: file.name,
          kind: 'file',
          icon: 'file',
          detail: name,
          afterClose: true,
          run: () => props.onFile(file.id),
        }),
      ),
    ...(props.onThread
      ? props.threads
          .filter((thread) => !thread.archivedAt)
          .map(
            (thread): PaletteItem => ({
              id: `${id}:thread:${thread.conversationId}`,
              label: thread.title,
              kind: 'thread',
              icon: 'thread',
              detail: name,
              recentAt: thread.createdAt,
              afterClose: true,
              run: () => current.current.onThread?.(thread),
            }),
          )
      : []),
    ...messageItems,
  ]
  usePaletteScope({
    id,
    name,
    available: props.available,
    primary: !!workspace,
    items,
  })
}
