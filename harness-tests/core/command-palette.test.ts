import { describe, expect, it } from 'vitest'
import {
  rankPalette,
  recordPaletteVisit,
  parsePaletteVisits,
  type PaletteCandidate,
} from '../../src/chat/core/command-palette'
import { conversationActionRequest } from '../../src/chat/core/conversation-actions'
import type { WorkspaceBot } from '../../src/chat/core/bot-workspace'
import { validateWorkspaceSearch } from '../../src/chat/core/navigation'

const item = (
  id: string,
  label: string,
  extra: Partial<PaletteCandidate> = {},
): PaletteCandidate => ({ id, label, kind: 'action', ...extra })
const ids = (items: PaletteCandidate[], query: string, options = {}) =>
  rankPalette(items, query, options).map((item) => item.id)
describe('command palette ranking', () => {
  it('does not treat scattered letters in message text as a command match', () => {
    const text =
      'This is a fixture response for testing the interface. No model or connected tool was called. Try starting a conversation.'
    expect(
      ids(
        [item('message', text, { kind: 'message', keywords: [text] })],
        'rename',
      ),
    ).toEqual([])
    expect(
      ids(
        [item('message', text, { kind: 'message', keywords: [text] })],
        'connected tool',
      ),
    ).toEqual(['message'])
  })
  it('keeps an exact conversation ahead of a popular contextual action', () => {
    const options = {
      now: 1000,
      visits: [{ id: 'action', query: 'archive', at: 1000, count: 100 }],
    }
    expect(
      ids(
        [
          item('action', 'Archive conversation', { context: 3 }),
          item('chat', 'Archive', { kind: 'conversation' }),
        ],
        'archive',
        options,
      ),
    ).toEqual(['chat', 'action'])
  })
  it('uses context and then learned choices only to break comparable matches', () => {
    const choices = [
      item('a', 'Design', { kind: 'conversation' }),
      item('b', 'Design', { kind: 'conversation' }),
    ]
    const options = {
      now: 1000,
      visits: [{ id: 'b', query: 'design', at: 1000, count: 4 }],
    }
    expect(ids(choices, 'design', options)[0]).toBe('b')
    expect(
      ids([{ ...choices[0]!, context: 3 }, choices[1]!], 'design', options)[0],
    ).toBe('a')
  })
  it('matches reordered terms, accents, typos and declared synonyms', () => {
    const choices = [
      item('prefs', 'Response preferences', { keywords: ['concise', 'tone'] }),
      item('chat', 'Café planning', { kind: 'conversation' }),
    ]
    expect(ids(choices, 'preferences response')).toEqual(['prefs'])
    expect(ids(choices, 'cafe plan')).toEqual(['chat'])
    expect(ids(choices, 'rspnse')).toEqual(['prefs'])
    expect(ids(choices, 'concise')).toEqual(['prefs'])
    expect(ids(choices, 'concise missing')).toEqual([])
  })
  it('finds a term after the first 200 characters of a loaded message', () => {
    expect(
      ids(
        [
          item('m', 'Long message', {
            kind: 'message',
            keywords: ['intro '.repeat(100) + 'chickadee'],
          }),
        ],
        'chickadee',
      ),
    ).toEqual(['m'])
  })
  it('keeps explicit aliases, removes duplicate identities, and filters types', () => {
    const choices = [
      item('theme', 'Appearance', { kind: 'setting', aliases: ['night'] }),
      item('chat', 'Night', { kind: 'conversation' }),
      item('chat', 'Duplicate'),
      item('thread', 'Night', { kind: 'thread' }),
    ]
    expect(ids(choices, 'night')[0]).toBe('theme')
    expect(ids(choices, 'night', { filter: 'conversation' })).toEqual([
      'chat',
      'thread',
    ])
  })
  it('does not fill the empty screen with destructive or obscure commands', () => {
    expect(
      ids(
        [
          item('delete', 'Delete'),
          item('new', 'New conversation', { suggested: true }),
          item('chat', 'Recent chat', { kind: 'conversation', recentAt: 1000 }),
        ],
        '',
      ),
    ).toEqual(['chat', 'new'])
  })
  it('limits type flooding without promoting a weaker match over the best five', () => {
    const choices = [
      ...Array.from({ length: 20 }, (_, i) =>
        item(`chat:${i}`, 'Design', { kind: 'conversation' }),
      ),
      item('action', 'Design settings'),
    ]
    const result = rankPalette(choices, 'design')
    expect(
      result.slice(0, 5).every((item) => item.kind === 'conversation'),
    ).toBe(true)
    expect(result.filter((item) => item.kind === 'conversation')).toHaveLength(
      8,
    )
    expect(result.some((item) => item.id === 'action')).toBe(true)
    expect(
      rankPalette(choices, 'design', { filter: 'conversation' }),
    ).toHaveLength(20)
  })
  it('bounds history and rejects corrupted stored state', () => {
    let visits = recordPaletteVisit([], 'a', '  CAFÉ  ', 100)
    visits = recordPaletteVisit(visits, 'a', 'cafe', 200)
    expect(visits).toEqual([{ id: 'a', query: 'cafe', at: 200, count: 2 }])
    for (let i = 0; i < 150; i++)
      visits = recordPaletteVisit(visits, `${i}`, '', i)
    expect(visits).toHaveLength(100)
    expect(parsePaletteVisits(JSON.stringify(visits))).toEqual(visits)
    for (const raw of [
      '{',
      '{}',
      'x'.repeat(150001),
      '[{"id":"x","query":"","at":0,"count":10000}]',
    ])
      expect(parsePaletteVisits(raw)).toEqual([])
  })
})

describe('shared conversation actions', () => {
  const bot = { id: 'opaque/id', version: 7, deleted_at: null } as WorkspaceBot
  it('retains the exact target and version for stale-write rejection', () => {
    expect(
      conversationActionRequest(bot, { type: 'rename', name: ' New name ' }),
    ).toEqual({
      path: 'bots/opaque%2Fid',
      method: 'PATCH',
      body: { name: 'New name', version: 7 },
    })
    expect(
      conversationActionRequest(bot, { type: 'archive', archived: true }).body,
    ).toEqual({ archived: true, version: 7 })
    expect(
      conversationActionRequest(bot, { type: 'pin', pinned: true }).path,
    ).toBe('bots/opaque%2Fid/organization')
  })
  it('refuses invalid names and deleted targets', () => {
    for (const name of ['', ' ', 'x'.repeat(61)])
      expect(() =>
        conversationActionRequest(bot, { type: 'rename', name }),
      ).toThrow()
    expect(() =>
      conversationActionRequest(
        { ...bot, deleted_at: 1 },
        { type: 'pin', pinned: true },
      ),
    ).toThrow('Restore')
  })
  it('only preserves supported setting destinations on the general tab', () => {
    expect(
      validateWorkspaceSearch({ settings: 'general', setting: 'response' })
        .setting,
    ).toBe('response')
    expect(
      validateWorkspaceSearch({ settings: 'general', setting: 'response' })
        .settings,
    ).toBe('preferences')
    expect(
      validateWorkspaceSearch({ settings: 'preferences', setting: 'timezone' })
        .setting,
    ).toBe('timezone')
    expect(
      validateWorkspaceSearch({ settings: 'plugins', setting: 'response' })
        .setting,
    ).toBeUndefined()
    expect(
      validateWorkspaceSearch({ settings: 'general', setting: 'unknown' })
        .setting,
    ).toBeUndefined()
  })
})
