import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import {
  referenceKey,
  referenceInput,
  type MessageReference,
} from '../../src/chat/core/message-references'
import {
  ComposerReferenceStore,
  addComposerReference,
  composerReferenceLimit,
  DraftComposerAttemptStore,
  captureReferenceSelection,
  composerReferencesKey,
  draftComposerAttemptKey,
  draftAttemptMatches,
  findReferenceTrigger,
  removeReferenceTrigger,
  submittedReferenceSelection,
} from '../../src/chat/components/useComposerReferences'
import { MessageReferences } from '../../src/chat/components/MessageReferences'
import { TaskSources } from '../../src/chat/components/TaskSources'
import {
  ComposerReferences,
  emptyToolCatalogText,
  parseReferenceCatalog,
} from '../../src/chat/components/ComposerReferences'

const conversation: MessageReference = {
  kind: 'conversation',
  botId: 'one',
  label: 'Planning',
}
const connection: MessageReference = {
  kind: 'connection',
  serverId: 'source',
  label: 'Connected source',
}
const file: MessageReference = {
  kind: 'file',
  botId: 'one',
  fileId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  label: 'notes.txt',
}
const tool: MessageReference = {
  kind: 'tool',
  serverId: 'alpha',
  toolName: 'search',
  label: 'Search',
  detail: 'Alpha connection',
}
const skill: MessageReference = {
  kind: 'skill',
  skillId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  version: 1,
  label: 'weekly-update',
  detail: 'Personal · v1',
}
const plugin: Extract<MessageReference, { kind: 'plugin' }> = {
  kind: 'plugin',
  installationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  version: 1,
  label: 'Weekly planning',
  detail: 'Installed v1',
}
const installedPlugin = (index: number): typeof plugin => ({
  ...plugin,
  installationId: `${index}ccccccc-cccc-4ccc-8ccc-cccccccccccc`,
})
function memory() {
  const entries = new Map<string, string>()
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value)
    },
    removeItem: (key: string) => {
      entries.delete(key)
    },
  }
}

describe('reference selection persistence', () => {
  it('replaces a plugin version at both limits, preserving its slot and protecting it from an older send', () => {
    const storage = memory()
    const store = new ComposerReferenceStore(storage, 'references')
    store.add(connection)
    for (let index = 0; index < 8; index++) store.add(installedPlugin(index))
    store.add(tool)
    const original = store.read()
    const captured = captureReferenceSelection(original)
    const changed = {
      ...installedPlugin(3),
      version: 2,
      detail: 'Installed v2',
    }
    expect(
      composerReferenceLimit(
        original.map((item) => item.reference),
        changed,
      ),
    ).toBe('')
    const updated = store.add(changed)
    expect(updated).toHaveLength(10)
    expect(updated[4].reference).toEqual(changed)
    expect(updated[4].token).not.toBe(original[4].token)
    expect(updated.filter((_, index) => index !== 4)).toEqual(
      original.filter((_, index) => index !== 4),
    )
    expect(new ComposerReferenceStore(storage, 'references').read()).toEqual(
      updated,
    )
    expect(store.add(changed)).toEqual(updated)
    expect(store.clearSubmitted(captured)).toEqual([updated[4]])
    expect(referenceInput(updated[4].reference)).toEqual({
      kind: 'plugin',
      installationId: changed.installationId,
      version: 2,
    })
  })
  it('blocks a ninth plugin and an eleventh reference without dropping or changing the saved selection', () => {
    const store = new ComposerReferenceStore(memory(), 'references')
    for (let index = 0; index < 8; index++) store.add(installedPlugin(index))
    const before = store.read()
    expect(
      composerReferenceLimit(
        before.map((item) => item.reference),
        installedPlugin(8),
      ),
    ).toContain('up to 8 plugins')
    expect(() => store.add(installedPlugin(8))).toThrow('up to 8 plugins')
    expect(store.read()).toEqual(before)
    store.add(connection)
    store.add(tool)
    const full = store.read()
    expect(
      composerReferenceLimit(
        full.map((item) => item.reference),
        conversation,
      ),
    ).toContain('up to 10 references')
    expect(() => store.add(conversation)).toThrow('up to 10 references')
    expect(store.read()).toEqual(full)
    const fewerPlugins = [
      plugin,
      ...Array.from({ length: 9 }, (_, index) => ({
        ...connection,
        serverId: `server-${index}`,
      })),
    ]
    expect(composerReferenceLimit(fewerPlugins, installedPlugin(1))).toContain(
      'up to 10 references',
    )
    expect(() =>
      addComposerReference(fewerPlugins, installedPlugin(1)),
    ).toThrow('up to 10 references')
    expect(
      addComposerReference(fewerPlugins, { ...plugin, version: 2 })[0],
    ).toMatchObject({ kind: 'plugin', version: 2 })
  })
  it('rejects two stored versions of one plugin and preserves storage failures during replacement', () => {
    const storage = memory()
    const store = new ComposerReferenceStore(storage, 'references')
    const original = store.add(plugin)
    storage.setItem(
      'corrupt',
      JSON.stringify([
        ...original,
        { reference: { ...plugin, version: 2 }, token: crypto.randomUUID() },
      ]),
    )
    expect(() => new ComposerReferenceStore(storage, 'corrupt').read()).toThrow(
      'could not be read',
    )
    storage.setItem = () => {}
    expect(() => store.add({ ...plugin, version: 2 })).toThrow(
      'could not be saved',
    )
    expect(store.read()).toEqual(original)
  })
  it('recovers the exact plugin first-send version while retaining a newer version selected afterward', () => {
    const storage = memory()
    const references = new ComposerReferenceStore(storage, 'references')
    const first = references.add(plugin)
    const snapshot = captureReferenceSelection(first)
    const store = new DraftComposerAttemptStore(storage, 'draft')
    const input = {
      text: 'Prepare the update',
      references: first.map((item) => referenceInput(item.reference)),
    }
    const attempt = store.create(input, input.text, snapshot)
    const later = references.add({ ...plugin, version: 2 })
    const recovered = new DraftComposerAttemptStore(storage, 'draft').read()!
    expect(recovered).toEqual(attempt)
    expect(recovered.input.references).toEqual([
      { kind: 'plugin', installationId: plugin.installationId, version: 1 },
    ])
    const receipt = { ...recovered.input, botId: 'created', started: true }
    expect(draftAttemptMatches(recovered, receipt)).toBe(true)
    expect(
      draftAttemptMatches(recovered, {
        ...receipt,
        references: [
          { kind: 'plugin', installationId: plugin.installationId, version: 2 },
        ],
      }),
    ).toBe(false)
    expect(references.clearSubmitted(recovered.referenceSelection)).toEqual(
      later,
    )
  })
  it('round-trips opaque room identities and cleanup keys across selection and draft recovery', () => {
    const storage = memory()
    const store = new ComposerReferenceStore(storage, 'references')
    for (let index = 0; index < 10; index++)
      store.add({
        kind: 'conversation',
        botId: '"'.repeat(200),
        conversationId: String(index) + '\u0000'.repeat(999),
        label: '\u0000'.repeat(200),
        detail: '\u0000'.repeat(200),
      })
    const entries = new ComposerReferenceStore(storage, 'references').read()
    expect(entries).toHaveLength(10)
    expect(storage.getItem('references')!.length).toBeGreaterThan(50000)
    const snapshot = captureReferenceSelection(entries)
    expect(snapshot.every((item) => item.key.length > 6000)).toBe(true)
    const drafts = new DraftComposerAttemptStore(storage, 'draft')
    const text = 'x' + '\u0000'.repeat(11999)
    const original = drafts.create(
      {
        text,
        references: entries.map((item) => referenceInput(item.reference)),
      },
      text,
      snapshot,
    )
    expect(storage.getItem('draft')!.length).toBeGreaterThan(250000)
    const remounted = new DraftComposerAttemptStore(storage, 'draft')
    expect(remounted.read()).toEqual(original)
    remounted.clear(original)
    expect(remounted.read()).toBeNull()
    expect(store.clearSubmitted(snapshot)).toEqual([])
  })
  it('replaces a selected skill version in place without letting an older send clear it', () => {
    const storage = memory()
    const store = new ComposerReferenceStore(storage, 'key')
    const submitted = captureReferenceSelection(store.add(skill))
    for (let index = 0; index < 9; index++)
      store.add({ ...conversation, botId: String(index) })
    const updated = store.add({ ...skill, version: 2, detail: 'Personal · v2' })
    expect(updated).toHaveLength(10)
    expect(updated[0].reference).toMatchObject({ kind: 'skill', version: 2 })
    expect(updated[0].token).not.toBe(submitted[0].token)
    expect(new ComposerReferenceStore(storage, 'key').read()).toEqual(updated)
    expect(store.clearSubmitted(submitted)).toEqual(updated)
    expect(referenceInput(updated[0].reference)).toEqual({
      kind: 'skill',
      skillId: skill.skillId,
      version: 2,
    })
  })
  it('limits unique skills and rejects corrupt storage with two versions of one skill', () => {
    const storage = memory()
    const store = new ComposerReferenceStore(storage, 'key')
    const original = store.add(skill)
    for (let index = 1; index <= 2; index++)
      store.add({
        ...skill,
        skillId: `${index}bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
      })
    expect(() =>
      store.add({ ...skill, skillId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
    ).toThrow('up to 3')
    expect(store.add({ ...skill, version: 2 })).toHaveLength(3)
    storage.setItem(
      'corrupt',
      JSON.stringify([
        ...original,
        { reference: { ...skill, version: 2 }, token: crypto.randomUUID() },
      ]),
    )
    expect(() => new ComposerReferenceStore(storage, 'corrupt').read()).toThrow(
      'could not be read',
    )
  })
  it('keeps same-name tools from different connections distinct through cleanup', () => {
    const storage = memory()
    const store = new ComposerReferenceStore(storage, 'key')
    const first = captureReferenceSelection(store.add(tool))
    const both = store.add({
      ...tool,
      serverId: 'beta',
      detail: 'Beta connection',
    })
    const remounted = new ComposerReferenceStore(storage, 'key')
    expect(remounted.read()).toEqual(both)
    expect(
      remounted
        .clearSubmitted(first)
        .map((item) => referenceInput(item.reference)),
    ).toEqual([{ kind: 'tool', serverId: 'beta', toolName: 'search' }])
  })
  it('round-trips maximum escaped tool identities and valid emoji through selection and first-send storage', () => {
    const storage = memory()
    const store = new ComposerReferenceStore(storage, 'references')
    for (let index = 0; index < 10; index++)
      store.add({
        kind: 'tool',
        serverId: String(index) + '"'.repeat(197) + '🧪',
        toolName: '\\'.repeat(198) + '🛠',
        label: '\u0000'.repeat(200),
        detail: '\u0000'.repeat(200),
      })
    const entries = new ComposerReferenceStore(storage, 'references').read()
    expect(entries).toHaveLength(10)
    const snapshot = captureReferenceSelection(entries)
    expect(
      snapshot.every(
        (item) => item.key.length > 500 && item.key.length <= 1000,
      ),
    ).toBe(true)
    const drafts = new DraftComposerAttemptStore(storage, 'draft')
    const text = 'x' + '\u0000'.repeat(11999)
    const original = drafts.create(
      {
        text,
        references: entries.map((item) => referenceInput(item.reference)),
      },
      text,
      snapshot,
    )
    const remounted = new DraftComposerAttemptStore(storage, 'draft')
    expect(remounted.read()).toEqual(original)
    remounted.clear(original)
    expect(remounted.read()).toBeNull()
    expect(store.clearSubmitted(snapshot)).toEqual([])
  })
  it('rejects malformed Unicode tool identities without losing earlier selections', () => {
    const store = new ComposerReferenceStore(memory(), 'key')
    const original = store.add(tool)
    expect(() => store.add({ ...tool, toolName: '\ud800' })).toThrow(
      'valid Unicode',
    )
    expect(() => store.add({ ...tool, serverId: '\udfff' })).toThrow(
      'valid Unicode',
    )
    expect(store.read()).toEqual(original)
  })
  it('recovers and clears ten references with maximum-length escaped labels and details', () => {
    const storage = memory()
    const store = new ComposerReferenceStore(storage, 'key')
    for (let index = 0; index < 10; index++)
      store.add({
        kind: 'connection',
        serverId: String(index) + '"'.repeat(199),
        label: '\u0000'.repeat(200),
        detail: '\u0000'.repeat(200),
      })
    expect(storage.getItem('key')!.length).toBeGreaterThan(20000)
    const original = store.read()
    const remounted = new ComposerReferenceStore(storage, 'key')
    expect(remounted.read()).toEqual(original)
    expect(
      remounted.clearSubmitted(captureReferenceSelection(original)),
    ).toEqual([])
    expect(storage.getItem('key')).toBeNull()
  })
  it('keeps exact identities and separates user, workspace and draft scopes', () => {
    const storage = memory()
    const keys = [
      composerReferencesKey('u', 'w', 'bots/one'),
      composerReferencesKey('other', 'w', 'bots/one'),
      composerReferencesKey('u', 'other', 'bots/one'),
      composerReferencesKey('u', 'w', 'bot-drafts/one'),
    ]
    expect(new Set(keys).size).toBe(4)
    const first = new ComposerReferenceStore(storage, keys[0])
    const added = first.add(file)
    expect(new ComposerReferenceStore(storage, keys[0]).read()).toEqual(added)
    for (const key of keys.slice(1))
      expect(new ComposerReferenceStore(storage, key).read()).toEqual([])
    expect(first.add({ ...file, label: 'A changed catalog label' })).toEqual(
      added,
    )
  })
  it('clears submitted tokens without erasing later selections or a re-added same ID', () => {
    const store = new ComposerReferenceStore(memory(), 'key')
    const submitted = captureReferenceSelection(store.add(conversation))
    store.add(connection)
    store.remove(referenceKey(conversation))
    const next = store.add(conversation)
    expect(
      next.find((item) => item.reference.kind === 'conversation')?.token,
    ).not.toBe(submitted[0].token)
    expect(store.clearSubmitted(submitted)).toEqual(next)
    expect(store.clearSubmitted([])).toEqual(next)
    expect(store.clearSubmitted(captureReferenceSelection(next))).toEqual([])
  })
  it('does not discard corrupt selection storage or silently accept dropped writes', () => {
    const storage = memory()
    storage.setItem('key', '{broken')
    const store = new ComposerReferenceStore(storage, 'key')
    expect(() => store.add(conversation)).toThrow()
    expect(storage.getItem('key')).toBe('{broken')
    expect(store.clear()).toEqual([])
    storage.setItem = () => {}
    expect(() => store.add(conversation)).toThrow('could not be saved')
  })
  it('limits references without dropping an earlier selection', () => {
    const store = new ComposerReferenceStore(memory(), 'key')
    for (let i = 0; i < 10; i++)
      store.add({ ...conversation, botId: String(i) })
    const before = store.read()
    expect(() => store.add(connection)).toThrow('up to 10')
    expect(store.read()).toEqual(before)
  })
  it('only cleans tokens for references confirmed in the first-send receipt', () => {
    const store = new ComposerReferenceStore(memory(), 'key')
    store.add(conversation)
    const snapshot = captureReferenceSelection(store.add(connection))
    expect(submittedReferenceSelection(snapshot, [conversation])).toEqual([
      snapshot[0],
    ])
    expect(submittedReferenceSelection(snapshot, [])).toEqual([])
  })
})

describe('tool reference catalog presentation', () => {
  it('accepts Kody results that are explicitly incomplete', () => {
    expect(
      parseReferenceCatalog(
        { items: [], more: false, kodyStatus: 'partial' },
        'kody',
      ).kodyStatus,
    ).toBe('partial')
  })
  it('keeps source freshness metadata and rejects an absent or invalid source catalog', () => {
    const toolSources = [
      {
        serverId: 'alpha',
        label: 'Alpha connection',
        status: 'stale' as const,
        fetchedAt: 123,
      },
    ]
    expect(
      parseReferenceCatalog(
        { items: [tool], more: false, toolSources },
        'tool',
      ),
    ).toEqual({ items: [tool], more: false, toolSources })
    expect(() =>
      parseReferenceCatalog({ items: [], more: false }, 'tool'),
    ).toThrow('sources could not be loaded')
    expect(() =>
      parseReferenceCatalog(
        {
          items: [],
          more: false,
          toolSources: [{ ...toolSources[0], status: 'invented' }],
        },
        'tool',
      ),
    ).toThrow()
    expect(
      parseReferenceCatalog(
        { items: [conversation], more: false },
        'conversation',
      ),
    ).toEqual({ items: [conversation], more: false })
  })
  it('distinguishes missing connections, unloaded sources, and an empty cached search', () => {
    const source = { serverId: 'alpha', label: 'Alpha' }
    expect(emptyToolCatalogText([])).toBe('No connections available.')
    for (const status of ['missing', 'stale'] as const)
      expect(emptyToolCatalogText([{ ...source, status }])).toContain(
        'Refresh a connection',
      )
    expect(emptyToolCatalogText([{ ...source, status: 'ready' }])).toBe(
      'No matching tools.',
    )
  })
  it('shows the source beside identical tool names in composer and transcript chips', () => {
    const references = [
      tool,
      { ...tool, serverId: 'beta', detail: 'Beta connection' },
    ]
    const transcript = renderToStaticMarkup(
      createElement(MessageReferences, { references }),
    )
    expect(transcript).toContain('Alpha connection')
    expect(transcript).toContain('Beta connection')
    expect(transcript.match(/lucide-wrench/g)).toHaveLength(2)
    expect(transcript).not.toContain('<a ')
    const html = renderToStaticMarkup(
      createElement(QueryClientProvider, {
        client: new QueryClient(),
        children: createElement(ComposerReferences, {
          userId: 'viewer',
          references: {
            items: references,
            busy: false,
            error: '',
            hasReferences: true,
            add: async () => true,
            remove: async () => true,
            clear: async () => true,
          },
          uploadedFileIds: [],
          onUpload: () => {},
          onSketch: () => {},
          composerInput: { current: null },
          mention: null,
          onCloseMention: () => {},
          onSelected: () => {},
        }),
      }),
    )
    expect(html).toContain('Remove reference Search from Alpha connection')
    expect(html).toContain('Remove reference Search from Beta connection')
    expect(html).toContain('<small>Alpha connection</small>')
    expect(html).toContain('<small>Beta connection</small>')
  })
})

describe('plugin reference presentation', () => {
  it('reads exact installed versions from the plugin catalog and rejects malformed version identity', () => {
    expect(
      parseReferenceCatalog({ items: [plugin], more: false }, 'plugin'),
    ).toEqual({ items: [plugin], more: false })
    for (const invalid of [
      { ...plugin, version: 0 },
      { ...plugin, version: Number.MAX_SAFE_INTEGER + 1 },
      { ...plugin, installationId: 'catalog-label' },
    ])
      expect(() =>
        parseReferenceCatalog({ items: [invalid], more: false }, 'plugin'),
      ).toThrow('could not be loaded')
  })
  it('shows installed plugin versions in composer, transcript and task details without implying skill activation', () => {
    const references = [
      plugin,
      { ...installedPlugin(2), version: 3, detail: undefined },
    ]
    const transcript = renderToStaticMarkup(
      createElement(MessageReferences, { references }),
    )
    const details = renderToStaticMarkup(
      createElement(TaskSources, { sources: references }),
    )
    const composer = renderToStaticMarkup(
      createElement(QueryClientProvider, {
        client: new QueryClient(),
        children: createElement(ComposerReferences, {
          userId: 'viewer',
          references: {
            items: references,
            busy: false,
            error: '',
            hasReferences: true,
            add: async () => true,
            remove: async () => true,
            clear: async () => true,
          },
          uploadedFileIds: [],
          onUpload: () => {},
          onSketch: () => {},
          composerInput: { current: null },
          mention: null,
          onCloseMention: () => {},
          onSelected: () => {},
        }),
      }),
    )
    for (const html of [transcript, details, composer]) {
      expect(html).toContain('Weekly planning')
      expect(html).toContain('<small>Installed v1</small>')
      expect(html).toContain('<small>Installed v3</small>')
      expect(html.match(/lucide-package/g)).toHaveLength(2)
      expect(html).not.toContain('lucide-plug ')
      expect(html).not.toContain('Activate')
      expect(html).not.toContain(plugin.installationId)
    }
    expect(details).toContain('aria-label="Plugin: Weekly planning"')
    expect(composer).toContain('aria-label="Remove reference Weekly planning"')
    expect(transcript).not.toContain('<a ')
  })
})

describe('reference trigger editing', () => {
  it.each([
    'https://example.com/notes',
    'Read /home/notes',
    'Read ./notes',
    'Read ../notes',
    '/SKILL.md',
    '/notes.md',
    'one/two',
    '//notes',
  ])('keeps path or URL %s literal', (text) => {
    expect(findReferenceTrigger(text, text.length)).toBeNull()
  })
  it('opens Skills for a slash token and removes only the unchanged selection', () => {
    expect(findReferenceTrigger('/会议记录', 5)).toMatchObject({
      kind: 'skill',
      query: '会议记录',
    })
    expect(findReferenceTrigger('/', 1)).toMatchObject({
      kind: 'skill',
      query: '',
      start: 0,
      end: 1,
    })
    const text = 'Use /weekly-notes for this update.'
    const end = text.indexOf(' for')
    const trigger = findReferenceTrigger(text, end)!
    expect(trigger).toMatchObject({ kind: 'skill', query: 'weekly-notes' })
    expect(removeReferenceTrigger(text, trigger)).toEqual({
      text: 'Use  for this update.',
      caret: 4,
    })
    expect(removeReferenceTrigger('Later: ' + text, trigger)).toEqual({
      text: 'Later: ' + text,
      caret: null,
    })
    expect(findReferenceTrigger('Read /home/notes', 10)).toBeNull()
    expect(findReferenceTrigger('/notes.md', 6)).toBeNull()
    expect(findReferenceTrigger('/weekly-notes', 1, 8)).toBeNull()
  })
  it.each([
    'person@example.com',
    'x@',
    'https://example.com/@work',
    'word@planning',
    '@a b',
  ])('does not open for %s', (text) => {
    expect(findReferenceTrigger(text, text.length)).toBeNull()
  })
  it('finds only the token at the caret and preserves the rest of the message', () => {
    const text = 'Compare @plan with last month.'
    const trigger = findReferenceTrigger(text, 13)!
    expect(trigger).toMatchObject({ start: 8, end: 13, query: 'plan' })
    expect(removeReferenceTrigger(text, trigger)).toEqual({
      text: 'Compare  with last month.',
      caret: 8,
    })
    expect(findReferenceTrigger('(@source', 8)?.query).toBe('source')
    expect(findReferenceTrigger('@source', 3, 5)).toBeNull()
  })
  it('does not remove text when the captured token moved during selection', () => {
    const trigger = findReferenceTrigger('Use @plan', 9)!
    expect(removeReferenceTrigger('Please use @plan', trigger)).toEqual({
      text: 'Please use @plan',
      caret: null,
    })
    expect(removeReferenceTrigger('Use @plan after lunch', trigger)).toEqual({
      text: 'Use  after lunch',
      caret: 4,
    })
  })
})

describe('durable first-send reference snapshots', () => {
  it('reuses the exact request and cleanup tokens after a reload instead of a new default', () => {
    const storage = memory()
    const key = draftComposerAttemptKey('u', 'w', 'draft')
    const store = new DraftComposerAttemptStore(storage, key)
    const token = {
      key: referenceKey(conversation),
      token: crypto.randomUUID(),
    }
    const original = store.create(
      {
        text: ' Compare plans ',
        references: [{ kind: 'conversation', botId: conversation.botId }],
        runModel: { provider: 'included', model: 'old-default' },
      },
      ' Compare plans ',
      [token],
    )
    const remounted = new DraftComposerAttemptStore(storage, key)
    expect(
      remounted.create(
        {
          text: 'Another task',
          runModel: { provider: 'included', model: 'new-default' },
        },
        'Another task',
        [],
      ),
    ).toEqual(original)
    expect(original.input.text).toBe('Compare plans')
    expect(original.rawText).toBe(' Compare plans ')
    expect(original.referenceSelection).toEqual([token])
    expect(
      draftAttemptMatches(original, {
        ...original.input,
        botId: 'created',
        started: true,
      }),
    ).toBe(true)
    expect(
      draftAttemptMatches(original, {
        ...original.input,
        references: [],
        botId: 'created',
        started: true,
      }),
    ).toBe(false)
    remounted.clear(original)
    const later = remounted.create({ text: 'Later' }, 'Later', [])
    remounted.clear(original)
    expect(remounted.read()).toEqual(later)
  })
  it('blocks posting when the frozen first-send request cannot be persisted', () => {
    const storage = memory()
    storage.setItem = () => {}
    expect(() =>
      new DraftComposerAttemptStore(storage, 'key').create(
        { text: 'Read this' },
        'Read this',
        [],
      ),
    ).toThrow('could not be saved safely')
  })
  it('round-trips maximum-length escaped text and ten long reference identities', () => {
    const storage = memory()
    const store = new DraftComposerAttemptStore(storage, 'key')
    const rawText = 'x' + '\u0000'.repeat(11999)
    const references = Array.from({ length: 10 }, (_, index) => ({
      kind: 'conversation' as const,
      botId: String(index) + 'x'.repeat(199),
    }))
    const snapshot = references.map((reference) => ({
      key: referenceKey(reference),
      token: crypto.randomUUID(),
    }))
    const attempt = store.create(
      { text: rawText, references },
      rawText,
      snapshot,
    )
    expect(storage.getItem('key')!.length).toBeGreaterThan(50000)
    expect(store.read()).toEqual(attempt)
    store.clear(attempt)
    expect(store.read()).toBeNull()
  })
})

it('renders non-file reference labels as text and leaves file chips to attachments', () => {
  const html = renderToStaticMarkup(
    createElement(MessageReferences, {
      references: [
        file,
        conversation,
        { ...connection, label: '<img onerror=alert(1)>' },
      ],
    }),
  )
  expect(html).toContain('Planning')
  expect(html).toContain('&lt;img onerror=alert(1)&gt;')
  expect(html).not.toContain('<img')
  expect(html).not.toContain('notes.txt')
})

it('renders selected skill identity and exact version without treating it as a connection', () => {
  const html = renderToStaticMarkup(
    createElement(MessageReferences, { references: [skill] }),
  )
  expect(html).toContain('weekly-update')
  expect(html).toContain('Personal · v1')
  expect(html).toContain('lucide-book-open')
  expect(html).not.toContain('lucide-plug')
})
