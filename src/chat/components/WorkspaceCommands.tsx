import { useRef, useState, type ReactNode } from 'react'
import type { Bootstrap } from './App'
import type { WorkspaceBot } from '../core/bot-workspace'
import type { WorkspaceSearch, SettingFocus } from '../core/navigation'
import type { BotView } from '../core/bot-views'
import type { PaletteItem, PalettePage } from './palette-types'
import { CommandPaletteProvider } from './CommandPalette'
import type { WorkspaceRequest } from './BotWorkspace'
import { setAppearanceSettings, useAppearanceSettings } from './Appearance'
import { localOnly, saveSyncedAppearance } from './appearance-account'
import { useAccountPreferences } from './account-preferences-client'
import { useQueryClient } from '@tanstack/react-query'
import { useSidebarDensity } from './sidebar-density'
import { BotEditor } from './BotWorkspace'
import {
  conversationActionRequest,
  type ConversationAction,
} from '../core/conversation-actions'
import { planBotDrop, type BotDropTarget } from '../core/bot-drag'

type Props = {
  data: Bootstrap
  request: WorkspaceRequest
  selected?: WorkspaceBot
  locationKey: string
  developer: boolean
  setDeveloper: (value: boolean) => void
  onSelect: (id: string) => void
  onCreate: (parent: string | null) => void
  onDuplicate: (bot: WorkspaceBot) => void
  onSettings: (tab: WorkspaceSearch['settings'], focus?: SettingFocus) => void
  onView: (view: BotView) => void
  onChanged: () => Promise<unknown>
  children: ReactNode
}

export function WorkspaceCommands(props: Props) {
  const { data, selected, children } = props
  const latest = useRef(props)
  latest.current = props
  const { request } = props
  const [appearanceSettings] = useAppearanceSettings()
  const appearance = appearanceSettings.mode
  const appearanceQuery = useAccountPreferences(data.user.id)
  const queryClient = useQueryClient()
  const [density, setDensity] = useSidebarDensity(data.user.id)
  const [editorId, setEditorId] = useState<string>()
  const editor = data.bots.find((bot) => bot.id === editorId)
  const assertCurrent = () => {
    if (
      latest.current.data.user.id !== data.user.id ||
      latest.current.data.workspace.id !== data.workspace.id
    )
      throw new Error('Your workspace changed. Open search again.')
  }
  const change = async (bot: WorkspaceBot, action: ConversationAction) => {
    assertCurrent()
    const command = conversationActionRequest(bot, action)
    await request(command.path, command.body, command.method)
  }
  const movePage = (bot: WorkspaceBot): PalettePage => {
    // Retain this exact layout while the destination is picked. The server rejects a stale move.
    const bots = data.bots,
      sections = data.sections
    const target = (
      id: string,
      label: string,
      destination: BotDropTarget,
    ): PaletteItem | undefined => {
      const plan = planBotDrop(
        bots,
        sections,
        { kind: 'bot', id: bot.id },
        destination,
      )
      if (!plan) return
      return {
        id,
        label,
        kind: 'action',
        icon: 'move',
        suggested: true,
        run: async () => {
          assertCurrent()
          await request(plan.path, plan.body, plan.method)
        },
      }
    }
    return {
      type: 'list',
      title: `Move ${bot.name}`,
      placeholder: 'Find a section or conversation…',
      items: [
        target('move:top', 'Top level', {
          kind: 'group',
          parentId: null,
          sectionId: null,
          pinned: false,
        }),
        ...sections.map((section) =>
          target(`move:section:${section.id}`, section.name, {
            kind: 'group',
            parentId: null,
            sectionId: section.id,
            pinned: false,
          }),
        ),
        ...bots.map((parent) =>
          target(`move:conversation:${parent.id}`, `Under ${parent.name}`, {
            kind: 'bot',
            id: parent.id,
            placement: 'inside',
          }),
        ),
      ].filter((item): item is PaletteItem => !!item),
    }
  }
  const botActions = (bot: WorkspaceBot, contextual = false): PaletteItem[] => {
    const common = {
      kind: 'action' as const,
      detail: bot.name,
      context: contextual ? 2 : 0,
    }
    return [
      {
        ...common,
        id: `bot:rename:${bot.id}`,
        label: 'Rename conversation…',
        icon: 'rename',
        keywords: ['title', 'name', 'change'],
        run: () => ({
          type: 'input',
          title: `Rename ${bot.name}`,
          label: 'Name',
          initialValue: bot.name,
          maxLength: 60,
          submitLabel: 'Rename',
          submit: (name) => change(bot, { type: 'rename', name }),
        }),
      },
      {
        ...common,
        id: `bot:pin:${bot.id}`,
        label: bot.pinned ? 'Unpin conversation' : 'Pin conversation',
        icon: 'pin',
        keywords: ['favorite', 'favourite'],
        run: () => change(bot, { type: 'pin', pinned: !bot.pinned }),
      },
      ...(bot.archived_at === null
        ? [
            {
              ...common,
              id: `bot:move:${bot.id}`,
              label: 'Move conversation…',
              icon: 'move' as const,
              keywords: ['organize', 'parent', 'section', 'nest'],
              run: () => movePage(bot),
            },
            {
              ...common,
              id: `bot:nest:${bot.id}`,
              label: 'New nested conversation',
              icon: 'plus' as const,
              keywords: ['child', 'sub bot'],
              afterClose: true,
              run: () => props.onCreate(bot.id),
            },
          ]
        : []),
      {
        ...common,
        id: `bot:duplicate:${bot.id}`,
        label: 'Duplicate conversation…',
        icon: 'copy',
        afterClose: true,
        keywords: ['copy', 'clone'],
        run: () => props.onDuplicate(bot),
      },
      {
        ...common,
        id: `bot:archive:${bot.id}`,
        label:
          bot.archived_at === null
            ? 'Archive conversation'
            : 'Unarchive conversation',
        icon: 'archive',
        run: () =>
          change(bot, { type: 'archive', archived: bot.archived_at === null }),
      },
      {
        ...common,
        id: `bot:settings:${bot.id}`,
        label: 'Conversation settings…',
        icon: 'settings',
        afterClose: true,
        keywords: ['purpose', 'instructions', 'delete', 'trash'],
        run: () => {
          assertCurrent()
          setEditorId(bot.id)
        },
      },
    ]
  }
  const settings = (
    id: string,
    label: string,
    tab: WorkspaceSearch['settings'],
    keywords: string[],
    focus?: SettingFocus,
  ): PaletteItem => ({
    id: `settings:${id}`,
    label,
    keywords,
    kind: 'setting',
    icon: 'settings',
    afterClose: true,
    run: () => props.onSettings(tab, focus),
  })
  const items: PaletteItem[] = [
    {
      id: 'new-conversation',
      label: 'New conversation',
      kind: 'action',
      icon: 'plus',
      keywords: ['new bot', 'chat', 'create'],
      suggested: true,
      context: 1,
      afterClose: true,
      run: () => props.onCreate(null),
    },
    ...data.bots
      .filter((bot) => bot.deleted_at === null && bot.archived_at === null)
      .map(
        (bot): PaletteItem => ({
          id: `conversation:${bot.id}`,
          label: bot.name,
          kind: 'conversation',
          icon: 'chat',
          keywords: [bot.purpose],
          detail: [
            bot.parent_id
              ? data.bots.find((parent) => parent.id === bot.parent_id)?.name
              : '',
            data.workspace.name,
          ]
            .filter(Boolean)
            .join(' · '),
          recentAt: bot.updated_at,
          afterClose: true,
          run: () => props.onSelect(bot.id),
          actions: () => ({
            type: 'list',
            title: bot.name,
            items: botActions(bot),
          }),
        }),
      ),
    ...(selected && selected.deleted_at === null
      ? botActions(selected, true)
      : []),
    {
      id: 'appearance',
      label: 'Appearance…',
      kind: 'setting',
      icon: 'sun',
      keywords: ['theme', 'dark', 'light', 'system', 'colors'],
      detail: appearance[0].toUpperCase() + appearance.slice(1),
      run: () => ({
        type: 'list',
        title: 'Appearance',
        items: (['system', 'light', 'dark'] as const).map((value) => ({
          id: `appearance:${value}`,
          label:
            value === 'system'
              ? 'Follow device'
              : value === 'light'
                ? 'Light'
                : 'Dark',
          kind: 'setting',
          icon: 'sun',
          detail: appearance === value ? 'Current' : undefined,
          run: async () => {
            const next = { ...appearanceSettings, mode: value }
            if (!localOnly(data.user.id)) {
              if (!appearanceQuery.data) {
                props.onSettings('appearance')
                return
              }
              await saveSyncedAppearance(
                data.user.id,
                next,
                appearanceQuery.data,
                async () => (await appearanceQuery.refetch()).data,
                queryClient,
              )
            }
            setAppearanceSettings(next)
          },
        })),
      }),
    },
    {
      id: 'sidebar-density',
      label: 'Sidebar density…',
      kind: 'setting',
      icon: 'layout',
      detail: density === 'compact' ? 'Compact' : 'Comfortable',
      keywords: [
        'compact',
        'comfortable',
        'spacing',
        'smaller',
        'larger',
        'clutter',
        'display',
      ],
      run: () => ({
        type: 'list',
        title: 'Sidebar density',
        items: (['comfortable', 'compact'] as const).map((value) => ({
          id: `density:${value}`,
          label: value === 'compact' ? 'Compact' : 'Comfortable',
          kind: 'setting',
          icon: 'layout',
          detail: density === value ? 'Current' : undefined,
          run: () => {
            setDensity(value)
          },
        })),
      }),
    },
    settings('general', 'Settings', 'general', ['preferences', 'account']),
    settings(
      'profile',
      'Your profile',
      'general',
      ['onboarding', 'name', 'organization'],
      'profile',
    ),
    settings(
      'response',
      'Response preferences',
      'preferences',
      [
        'tone',
        'detail',
        'language',
        'writing',
        'personality',
        'shorter',
        'concise',
      ],
      'response',
    ),
    settings(
      'timezone',
      'Timezone',
      'preferences',
      ['time zone', 'schedule', 'location'],
      'timezone',
    ),
    settings('connections', 'Connections', 'mcp', [
      'mcp',
      'integrations',
      'kody',
      'connect',
      'tools',
    ]),
    settings('plugins', 'Plugins', 'plugins', [
      'install',
      'extensions',
      'abilities',
    ]),
    settings('skills', 'Skills', 'skills', [
      'instructions',
      'slash',
      'customize',
    ]),
    settings('actions', 'Saved actions', 'actions', ['recipes', 'automation']),
    {
      id: 'developer-mode',
      label: 'Developer mode…',
      kind: 'setting',
      icon: 'settings',
      detail: props.developer ? 'On' : 'Off',
      keywords: ['advanced', 'technical', 'traces', 'code', 'policy'],
      run: () => ({
        type: 'list',
        title: 'Developer mode',
        items: [true, false].map((value) => ({
          id: `developer:${value}`,
          label: value ? 'On' : 'Off',
          kind: 'setting',
          detail: props.developer === value ? 'Current' : undefined,
          run: () => props.setDeveloper(value),
        })),
      }),
    },
    ...(props.developer
      ? [
          settings('models', 'AI connections', 'connection', [
            'provider',
            'model',
            'key',
            'gateway',
          ]),
          settings('policy', 'Workspace policy', 'policy', [
            'budget',
            'limit',
            'permissions',
            'models',
          ]),
          settings('contracts', 'MCP contracts', 'contracts', [
            'tools',
            'schema',
          ]),
        ]
      : []),
    ...(
      [
        ['recent', 'Recent conversations', ['history']],
        ['attention', 'Needs attention', ['approvals', 'errors', 'waiting']],
        ['archived', 'Archived conversations', ['archive']],
        ['trash', 'Trash', ['deleted', 'restore']],
      ] as const
    ).map(
      ([view, label, keywords]): PaletteItem => ({
        id: `view:${view}`,
        label,
        kind: 'action',
        icon: 'chat',
        keywords: [...keywords],
        afterClose: true,
        run: () =>
          props.onView({ view, sort: 'activity', group: 'none', q: '' }),
      }),
    ),
  ]
  return (
    <CommandPaletteProvider
      key={`${data.user.id}:${data.workspace.id}`}
      userId={data.user.id}
      workspaceId={data.workspace.id}
      locationKey={props.locationKey}
      items={items}
    >
      {children}
      {editor && (
        <BotEditor
          key={editor.id}
          bot={editor}
          bots={data.bots}
          sections={data.sections}
          request={request}
          onChanged={async () => {
            await props.onChanged()
          }}
          onClose={() => setEditorId(undefined)}
        />
      )}
    </CommandPaletteProvider>
  )
}
