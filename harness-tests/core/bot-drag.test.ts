import { describe, it, expect } from 'vitest'
import {
  planBotDrop,
  botDropPlacement,
  botDragLayout,
} from '../../src/chat/core/bot-drag'
import type { WorkspaceBot } from '../../src/chat/core/bot-workspace'
function bot(
  id: string,
  position: number,
  parent_id: string | null = null,
): WorkspaceBot {
  return {
    id,
    name: id,
    parent_id,
    position,
    section_id: null,
    pinned: false,
    version: 1,
    archived_at: null,
    deleted_at: null,
    created_at: 0,
  } as WorkspaceBot
}
describe('drag planning', () => {
  it('unpins chats dropped into Recent or next to an unpinned chat', () => {
    const bots = [{ ...bot('a', 0), pinned: true }, bot('b', 0)]
    for (const target of [
      {
        kind: 'group' as const,
        parentId: null,
        sectionId: null,
        pinned: false,
      },
      { kind: 'bot' as const, id: 'b', placement: 'before' as const },
    ]) {
      expect(
        planBotDrop(bots, [], { kind: 'bot', id: 'a' }, target)?.body,
      ).toMatchObject({ pinned: false, sectionId: null })
    }
  })
  it('moves the selected roots in displayed order and carries overlapping children once', () => {
    const bots = [bot('a', 0), bot('child', 0, 'a'), bot('b', 1), bot('c', 2)]
    const plan = planBotDrop(
      bots,
      [],
      { kind: 'bot', id: 'b', ids: ['a', 'child', 'b'] },
      { kind: 'bot', id: 'c', placement: 'after' },
    )
    expect(plan?.path).toBe('bots/move')
    expect(plan?.body).toMatchObject({
      bots: [
        { id: 'a', version: 1 },
        { id: 'child', version: 1 },
        { id: 'b', version: 1 },
      ],
      parentId: null,
      position: 1,
    })
    expect(plan?.announcement).toBe(
      'Move 2 conversations with their children after c',
    )
  })
  it('ignores group drops onto a selected row, into its descendants, or at the same position', () => {
    const bots = [bot('a', 0), bot('child', 0, 'a'), bot('b', 1), bot('c', 2)]
    const source = { kind: 'bot' as const, id: 'a', ids: ['a', 'b'] }
    for (const target of [
      { kind: 'bot' as const, id: 'b', placement: 'inside' as const },
      { kind: 'bot' as const, id: 'child', placement: 'inside' as const },
      { kind: 'bot' as const, id: 'c', placement: 'before' as const },
    ])
      expect(planBotDrop(bots, [], source, target)).toBeNull()
  })
  it('starts a single move when the picked row is not selected', () => {
    const bots = [bot('a', 0), bot('b', 1), bot('c', 2)]
    expect(
      planBotDrop(
        bots,
        [],
        { kind: 'bot', id: 'c', ids: ['a', 'b'] },
        { kind: 'bot', id: 'a', placement: 'before' },
      )?.path,
    ).toBe('bots/c/move')
  })
  it('uses all peers even when some rows are not displayed', () => {
    const bots = [bot('a', 0), bot('hidden', 1), bot('b', 2), bot('c', 3)]
    const plan = planBotDrop(
      bots,
      [],
      { kind: 'bot', id: 'a' },
      { kind: 'bot', id: 'c', placement: 'before' },
    )
    expect(plan?.body).toMatchObject({
      position: 2,
      layout: botDragLayout(bots),
    })
  })
  it('rejects descendant cycles and unchanged insertion positions', () => {
    expect(
      planBotDrop(
        [bot('a', 0), bot('b', 0, 'a')],
        [],
        { kind: 'bot', id: 'a' },
        { kind: 'bot', id: 'b', placement: 'inside' },
      ),
    ).toBe(null)
    expect(
      planBotDrop(
        [bot('a', 0), bot('b', 1)],
        [],
        { kind: 'bot', id: 'a' },
        { kind: 'bot', id: 'b', placement: 'before' },
      ),
    ).toBe(null)
  })
  it('uses center for nesting and narrow edges for sibling insertion', () => {
    expect([5, 50, 95].map((y) => botDropPlacement(y, 0, 100))).toEqual([
      'before',
      'inside',
      'after',
    ])
    expect(botDropPlacement(50, 0, 100, false)).toBe('after')
  })
  it('treats pinned bots from different sections as one visible peer group', () => {
    const bots = [
      { ...bot('a', 0), pinned: true, section_id: 'x' },
      { ...bot('b', 1), pinned: true, section_id: 'y' },
      { ...bot('c', 2), pinned: true },
    ]
    expect(
      planBotDrop(
        bots,
        [],
        { kind: 'bot', id: 'a' },
        { kind: 'bot', id: 'c', placement: 'after' },
      )?.body,
    ).toMatchObject({ position: 2, pinned: true, sectionId: null })
  })
})
