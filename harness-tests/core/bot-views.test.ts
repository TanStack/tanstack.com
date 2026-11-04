import { describe, expect, it } from 'vitest'
import {
  defaultBotView,
  descendantIds,
  isUnread,
  needsAttention,
  selectBotGroups,
  type BotActivity,
  type BotView,
} from '../../src/chat/core/bot-views'
import type {
  BotSection,
  WorkspaceBot,
} from '../../src/chat/core/bot-workspace'

const bot = (
  id: string,
  overrides: Partial<WorkspaceBot> = {},
): WorkspaceBot => ({
  id,
  workspace_id: 'workspace',
  name: id,
  purpose: '',
  parent_id: null,
  created_at: 1,
  updated_at: 1,
  version: 1,
  archived_at: null,
  deleted_at: null,
  pinned: false,
  section_id: null,
  position: 0,
  tags: [],
  ...overrides,
})
const event = (overrides: Partial<BotActivity> = {}): BotActivity => ({
  status: 'completed',
  activity_at: 10,
  event_version: 3,
  read_version: 2,
  preview: 'Done',
  message_count: 2,
  ...overrides,
})
const select = (
  bots: WorkspaceBot[],
  view: Partial<BotView> = {},
  activity: Record<string, BotActivity> = {},
  sections: BotSection[] = [],
) =>
  selectBotGroups({
    bots,
    sections,
    activity,
    view: { ...defaultBotView, ...view },
  })
const ids = (groups: ReturnType<typeof select>) =>
  groups.flatMap((group) => group.rows.map((row) => row.bot.id))

describe('bot views', () => {
  it('keeps Recent when the last chat is unpinned', () => {
    expect(
      select([bot('pinned', { pinned: true }), bot('other')]).map(
        (group) => group.label,
      ),
    ).toEqual(['Pinned', 'Recent'])
    expect(
      select([bot('pinned'), bot('other')]).map((group) => group.label),
    ).toEqual(['Recent'])
  })

  it('labels unsectioned conversations with or without custom sections', () => {
    const bots = [bot('a')]
    const sections = [{ id: 'work', name: 'Work', position: 0, version: 1 }]
    expect(select(bots, {}, {}, sections)[0].label).toBe('Recent')
    expect(select(bots)[0].label).toBe('Recent')
    expect(select(bots, { group: 'none' }, {}, sections)[0].label).toBe('')
  })

  it('sorts sections separately and lets a section override then clear the default', () => {
    const bots = [
      bot('zeta', {
        name: 'Zeta',
        section_id: 'a',
        position: 0,
        updated_at: 3,
      }),
      bot('alpha', {
        name: 'Alpha',
        section_id: 'a',
        position: 1,
        updated_at: 4,
      }),
      bot('other', {
        name: 'Other',
        section_id: 'b',
        position: 0,
        updated_at: 20,
      }),
    ]
    const sections: BotSection[] = [
      {
        id: 'a',
        name: 'Z section',
        position: 0,
        version: 0,
        sort_override: 'name',
      },
      {
        id: 'b',
        name: 'A section',
        position: 1,
        version: 0,
        sort_override: null,
      },
    ]
    const groups = select(
      bots,
      { sort: 'position', sectionSort: 'name' },
      {},
      sections,
    )
    expect(groups.map((group) => group.label)).toEqual([
      'A section',
      'Z section',
    ])
    expect(groups[1].rows.map((row) => row.bot.id)).toEqual(['alpha', 'zeta'])
    sections[0].sort_override = null
    expect(
      select(bots, { sort: 'position' }, {}, sections)[0].rows.map(
        (row) => row.bot.id,
      ),
    ).toEqual(['zeta', 'alpha'])
  })
  it('keeps active, archived and deleted records in separate views', () => {
    const bots = [
      bot('active'),
      bot('archived', { archived_at: 10 }),
      bot('deleted', { deleted_at: 20, archived_at: 10 }),
    ]
    expect(ids(select(bots))).toEqual(['active'])
    expect(ids(select(bots, { view: 'archived' }))).toEqual(['archived'])
    expect(ids(select(bots, { view: 'trash' }))).toEqual(['deleted'])
  })

  it('promotes a matching descendant instead of hiding it with a filtered parent', () => {
    const groups = select(
      [
        bot('parent'),
        bot('child', { parent_id: 'parent', purpose: 'travel' }),
        bot('grandchild', { parent_id: 'child', purpose: 'travel planning' }),
      ],
      { q: 'TRAVEL' },
    )
    expect(
      groups[0].rows.map(({ bot, depth, promoted }) => [
        bot.id,
        depth,
        promoted,
      ]),
    ).toEqual([
      ['child', 0, true],
      ['grandchild', 1, false],
    ])
  })

  it('keeps a child visible when its parent is archived or in another section', () => {
    const bots = [
      bot('archived', { archived_at: 1 }),
      bot('child', { parent_id: 'archived' }),
      bot('other', { parent_id: 'child', section_id: 'work' }),
    ]
    const groups = select(bots, {}, {}, [
      { id: 'work', name: 'Work', position: 0, version: 1 },
    ])
    expect(
      groups.map((group) => [
        group.label,
        group.rows.map((row) => [row.bot.id, row.depth]),
      ]),
    ).toEqual([
      ['Work', [['other', 0]]],
      ['Recent', [['child', 0]]],
    ])
  })

  it('orders pinned bots, sections and unsectioned bots without duplicates', () => {
    const groups = select(
      [
        bot('a', { section_id: 'later' }),
        bot('b', { section_id: 'first' }),
        bot('c'),
        bot('d', { parent_id: 'a', pinned: true, section_id: 'later' }),
      ],
      {},
      {},
      [
        { id: 'later', name: 'Later', position: 1, version: 1 },
        { id: 'first', name: 'First', position: 0, version: 1 },
      ],
    )
    expect(groups.map((group) => group.label)).toEqual([
      'Pinned',
      'First',
      'Later',
      'Recent',
    ])
    expect(ids(groups)).toEqual(['d', 'b', 'a', 'c'])
    expect(new Set(ids(groups)).size).toBe(4)
  })

  it('does not invent recent activity or count archived bots as attention', () => {
    const bots = [
      bot('new'),
      bot('finished'),
      bot('archived', { archived_at: 5 }),
    ]
    const activity = {
      finished: event(),
      archived: event({ status: 'approval' }),
    }
    expect(ids(select(bots, { view: 'recent' }, activity))).toEqual([
      'finished',
    ])
    expect(ids(select(bots, { view: 'attention' }, activity))).toEqual([
      'finished',
      'new',
    ])
  })

  it('prioritizes waiting sections and keeps answered chats afterward', () => {
    const bots = [
      bot('old', { section_id: 'work', parent_id: 'answered' }),
      bot('new', { section_id: 'work' }),
      bot('answered', { section_id: 'work' }),
      bot('other', { section_id: 'personal', pinned: true }),
    ]
    const sections = [
      { id: 'personal', name: 'Personal', position: 0, version: 1 },
      {
        id: 'work',
        name: 'Work',
        position: 1,
        version: 1,
        sort_override: 'name' as const,
      },
    ]
    const activity = {
      old: event({ status: 'approval', activity_at: 10, read_version: 3 }),
      new: event({ activity_at: 20 }),
      answered: event({ activity_at: 40, read_version: 3 }),
      other: event({ activity_at: 50, read_version: 3 }),
    }
    const groups = select(
      bots,
      { view: 'attention', group: 'status' },
      activity,
      sections,
    )
    expect(groups.map((group) => group.label)).toEqual(['Work', 'Personal'])
    expect(ids(groups)).toEqual(['old', 'new', 'answered', 'other'])
  })

  it('distinguishes unread results from unresolved approvals and errors', () => {
    expect(isUnread(event())).toBe(true)
    expect(isUnread(event({ read_version: 3 }))).toBe(false)
    expect(needsAttention(event())).toBe(true)
    expect(needsAttention(event({ read_version: 3 }))).toBe(false)
    expect(needsAttention(event({ status: 'approval', read_version: 3 }))).toBe(
      true,
    )
    expect(needsAttention(event({ status: 'setup', read_version: 3 }))).toBe(
      true,
    )
    expect(needsAttention(event({ status: 'error', read_version: 3 }))).toBe(
      true,
    )
    expect(needsAttention(event({ status: 'running' }))).toBe(false)
    expect(needsAttention(undefined)).toBe(false)
  })

  it('does not treat empty initialized activity as unread or recent', () => {
    const initial = event({
      status: 'idle',
      event_version: 1,
      read_version: 0,
      preview: '',
      message_count: 0,
      activity_at: 100,
    })
    const bots = [bot('new'), bot('finished')]
    const activity = { new: initial, finished: event() }
    expect(isUnread(initial)).toBe(false)
    expect(needsAttention(initial)).toBe(false)
    expect(ids(select(bots, { view: 'recent' }, activity))).toEqual([
      'finished',
    ])
    expect(ids(select(bots, { sort: 'activity' }, activity))).toEqual([
      'finished',
      'new',
    ])
    expect(ids(select(bots, { sort: 'unread' }, activity))).toEqual([
      'finished',
      'new',
    ])
  })

  it.each<BotActivity['status']>([
    'idle',
    'running',
    'approval',
    'setup',
    'error',
    'completed',
  ])('keeps meaningful %s activity unread and recent', (status) => {
    const activity = event({
      status,
      preview: '',
      message_count: status === 'idle' ? 1 : 0,
    })
    expect(isUnread(activity)).toBe(true)
    expect(
      ids(select([bot('active')], { view: 'recent' }, { active: activity })),
    ).toEqual(['active'])
  })

  it('sorts unread work oldest first and then read work newest first', () => {
    const bots = ['unread-new', 'read-old', 'unread-old', 'read-new'].map(
      (id) => bot(id),
    )
    const activity = {
      'unread-new': event({ activity_at: 40 }),
      'unread-old': event({ activity_at: 20 }),
      'read-new': event({ activity_at: 50, read_version: 3 }),
      'read-old': event({ activity_at: 10, read_version: 3 }),
    }
    expect(ids(select(bots, { sort: 'unread' }, activity))).toEqual([
      'unread-old',
      'unread-new',
      'read-new',
      'read-old',
    ])
  })

  it('matches the server order when several bots still have the initial position', () => {
    const bots = [
      bot('a', { created_at: 20 }),
      bot('z', { created_at: 10 }),
      bot('b', { created_at: 10 }),
    ]
    expect(ids(select(bots))).toEqual(['b', 'z', 'a'])
    expect(ids(select(bots, { sort: 'name' }))).toEqual(['a', 'b', 'z'])
  })

  it('groups by actionable status and promotes children crossing a status group', () => {
    const bots = [
      bot('parent'),
      bot('child', { parent_id: 'parent' }),
      bot('ready'),
    ]
    const groups = select(
      bots,
      { group: 'status' },
      {
        parent: event({ status: 'running' }),
        child: event({ status: 'approval' }),
      },
    )
    expect(
      groups.map((group) => [
        group.label,
        group.rows[0].bot.id,
        group.rows[0].depth,
      ]),
    ).toEqual([
      ['Needs approval', 'child', 0],
      ['Working', 'parent', 0],
      ['Ready', 'ready', 0],
    ])
  })

  it('keeps malformed cyclic records reachable without looping', () => {
    const bots = [
      bot('a', { parent_id: 'b' }),
      bot('b', { parent_id: 'a' }),
      bot('c', { parent_id: 'b' }),
    ]
    expect(ids(select(bots))).toEqual(['a', 'b', 'c'])
    expect([...descendantIds(bots, 'a')].sort()).toEqual(['b', 'c'])
  })
})
