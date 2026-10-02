import {
  useCloudDraft,
  cloudDraftChanged,
  applyCloudSelection,
} from './useCloudDraft'
import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import {
  maxMessageReferences,
  maxSelectedPlugins,
  messageReferenceSchema,
  referenceInput,
  referenceKey,
  referenceInputsSchema,
  type MessageReference,
  type ReferenceInput,
} from '../core/message-references'
import { maxSelectedSkills } from '../core/skill-identifiers'
import type { ReferenceSelectionSnapshot } from '../core/send-receipt'
import { referenceSelectionSchema } from '../core/send-receipt'
import { botDraftInput, type BotDraftReceipt } from '../core/bot-draft'
import { sameRunModel } from '../core/run-model'
import { useWorkspaceApi } from './WorkspaceApi'

const storedReferencesSchema = z
  .array(
    z
      .object({
        reference: messageReferenceSchema,
        token: z.string().uuid(),
      })
      .strict(),
  )
  .max(maxMessageReferences)
  .refine(
    (items) =>
      new Set(items.map((item) => referenceKey(item.reference))).size ===
      items.length,
  )
  .refine(
    (items) =>
      referenceInputsSchema.safeParse(
        items.map((item) => referenceInput(item.reference)),
      ).success,
  )
export type StoredComposerReference = z.infer<
  typeof storedReferencesSchema
>[number]
type ReferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
// Covers ten references with fully escaped display fields and opaque
// 1000-character conversation IDs, plus cleanup tokens.
const maxStoredReferenceCharacters = 128_000
export const composerReferencesKey = (
  userId: string,
  workspaceId: string | undefined,
  resourcePath: string,
) =>
  JSON.stringify([
    'gum',
    'composer-references',
    1,
    userId,
    workspaceId,
    resourcePath,
  ])

function referenceReplacementIndex(
  current: MessageReference[],
  reference: MessageReference,
) {
  return current.findIndex(
    (item) =>
      (reference.kind === 'skill' &&
        item.kind === 'skill' &&
        item.skillId === reference.skillId) ||
      (reference.kind === 'plugin' &&
        item.kind === 'plugin' &&
        item.installationId === reference.installationId),
  )
}

export function composerReferenceLimit(
  current: MessageReference[],
  reference: MessageReference,
) {
  if (referenceReplacementIndex(current, reference) >= 0) return ''
  if (
    reference.kind === 'skill' &&
    current.filter((item) => item.kind === 'skill').length >= maxSelectedSkills
  )
    return 'Select up to 3 skills per message.'
  if (
    reference.kind === 'plugin' &&
    current.filter((item) => item.kind === 'plugin').length >=
      maxSelectedPlugins
  )
    return 'Select up to 8 plugins per message.'
  return current.length >= maxMessageReferences
    ? 'Select up to 10 references per message.'
    : ''
}

/** Shared by the ordinary and atomic retry drafts, including version changes. */
export function addComposerReference(
  current: MessageReference[],
  reference: MessageReference,
) {
  const parsed = messageReferenceSchema.parse(reference)
  if (current.some((item) => referenceKey(item) === referenceKey(parsed)))
    return current
  const limit = composerReferenceLimit(current, parsed)
  if (limit) throw new Error(limit)
  const replaced = referenceReplacementIndex(current, parsed)
  return replaced >= 0
    ? current.map((item, index) => (index === replaced ? parsed : item))
    : [...current, parsed]
}

export class ComposerReferenceStore {
  constructor(
    private storage: ReferenceStorage,
    readonly key: string,
  ) {}
  read() {
    const raw = this.storage.getItem(this.key)
    if (raw === null) return []
    if (raw.length > maxStoredReferenceCharacters)
      throw new Error(
        'Saved references could not be read. Clear them before sending.',
      )
    const parsed = storedReferencesSchema.safeParse(JSON.parse(raw))
    if (!parsed.success)
      throw new Error(
        'Saved references could not be read. Clear them before sending.',
      )
    return parsed.data
  }
  write(items: StoredComposerReference[]) {
    const serialized = JSON.stringify(storedReferencesSchema.parse(items))
    if (serialized.length > maxStoredReferenceCharacters)
      throw new Error('References are too large to save safely on this device.')
    if (items.length) this.storage.setItem(this.key, serialized)
    else this.storage.removeItem(this.key)
    cloudDraftChanged(this.key, items.length ? serialized : '')
    if (this.storage.getItem(this.key) !== (items.length ? serialized : null))
      throw new Error('References could not be saved on this device.')
    return items
  }
  add(reference: MessageReference) {
    const current = this.read()
    const references = current.map((item) => item.reference)
    const next = addComposerReference(references, reference)
    if (next === references) return current
    return this.write(
      next.map((item, index) =>
        current[index]?.reference === item
          ? current[index]
          : { reference: item, token: crypto.randomUUID() },
      ),
    )
  }
  remove(key: string) {
    return this.write(
      this.read().filter((item) => referenceKey(item.reference) !== key),
    )
  }
  clearSubmitted(snapshot: ReferenceSelectionSnapshot) {
    if (!snapshot.length) return this.read()
    const captured = new Map(snapshot.map((item) => [item.key, item.token]))
    return this.write(
      this.read().filter(
        (item) => captured.get(referenceKey(item.reference)) !== item.token,
      ),
    )
  }
  clear() {
    return this.write([])
  }
}

export type ReferenceTrigger = {
  start: number
  end: number
  query: string
  prefix: string
  kind?: 'skill'
}
/** Unfinished reference tokens stay literal text until a selection is saved. */
export function findReferenceTrigger(
  text: string,
  start: number | null,
  end = start,
): ReferenceTrigger | null {
  if (start === null || start !== end || start < 0 || start > text.length)
    return null
  const prefix = text.slice(0, start)
  const mention = /(?:^|[\s([{])@([^\s@()[\]{},;:]*)$/u.exec(prefix)
  const slash = mention
    ? null
    : /(?:^|[\s([{])\/([\p{L}\p{N}-]*)$/u.exec(prefix)
  const match = mention ?? slash
  if (!match) return null
  // Do not turn a path, URL or filename into a skill when the caret is in it.
  if (slash && /^[^\s()[\]{},;]*[\/\\.:?#]/u.test(text.slice(start)))
    return null
  return {
    start: start - match[1].length - 1,
    end: start,
    query: match[1],
    prefix,
    ...(slash ? { kind: 'skill' as const } : {}),
  }
}
export function removeReferenceTrigger(
  text: string,
  trigger: ReferenceTrigger,
) {
  // A changed prefix means this is no longer the token the person selected.
  if (text.slice(0, trigger.end) !== trigger.prefix)
    return { text, caret: null }
  return {
    text: text.slice(0, trigger.start) + text.slice(trigger.end),
    caret: trigger.start,
  }
}
export const captureReferenceSelection = (
  items: StoredComposerReference[],
): ReferenceSelectionSnapshot =>
  items.map((item) => ({
    key: referenceKey(item.reference),
    token: item.token,
  }))
export function submittedReferenceSelection(
  snapshot: ReferenceSelectionSnapshot,
  inputs: ReferenceInput[],
) {
  const included = new Set(inputs.map(referenceKey))
  return snapshot.filter((item) => included.has(item.key))
}

const draftAttemptSchema = z
  .object({
    id: z.string().uuid(),
    input: botDraftInput,
    rawText: z.string().max(12000),
    referenceSelection: referenceSelectionSchema,
  })
  .strict()
export type DraftComposerAttempt = z.infer<typeof draftAttemptSchema>
// Includes both 12k-character text fields at JSON's worst-case escaping size,
// plus bounded model, reference IDs, and cleanup tokens.
const maxDraftAttemptCharacters = 700_000
export const draftComposerAttemptKey = (
  userId: string,
  workspaceId: string | undefined,
  draftId: string,
) => JSON.stringify(['gum', 'draft-send', 1, userId, workspaceId, draftId])
export class DraftComposerAttemptStore {
  constructor(
    private storage: ReferenceStorage,
    readonly key: string,
  ) {}
  read(): DraftComposerAttempt | null {
    const raw = this.storage.getItem(this.key)
    if (raw === null) return null
    if (raw.length > maxDraftAttemptCharacters)
      throw new Error('The first send could not be recovered on this device.')
    return draftAttemptSchema.parse(JSON.parse(raw))
  }
  create(
    input: z.input<typeof botDraftInput>,
    rawText: string,
    referenceSelection: ReferenceSelectionSnapshot,
  ) {
    const existing = this.read()
    if (existing) return existing
    const attempt = draftAttemptSchema.parse({
      id: crypto.randomUUID(),
      input,
      rawText,
      referenceSelection,
    })
    const serialized = JSON.stringify(attempt)
    if (serialized.length > maxDraftAttemptCharacters)
      throw new Error(
        'The first send is too large to save safely on this device.',
      )
    this.storage.setItem(this.key, serialized)
    if (this.storage.getItem(this.key) !== serialized)
      throw new Error(
        'The first send could not be saved safely on this device.',
      )
    return attempt
  }
  clear(attempt: DraftComposerAttempt) {
    if (this.read()?.id !== attempt.id) return
    this.storage.removeItem(this.key)
    if (this.storage.getItem(this.key) !== null)
      throw new Error('The first send could not be cleared on this device.')
  }
}
export function draftAttemptMatches(
  attempt: DraftComposerAttempt,
  receipt: BotDraftReceipt,
) {
  return (
    attempt.input.text === receipt.text &&
    attempt.input.parentId === receipt.parentId &&
    JSON.stringify(attempt.input.fileIds) === JSON.stringify(receipt.fileIds) &&
    JSON.stringify(attempt.input.references.map(referenceKey)) ===
      JSON.stringify((receipt.references ?? []).map(referenceKey)) &&
    (receipt.runModel === undefined ||
      sameRunModel(attempt.input.runModel, receipt.runModel))
  )
}

type State = {
  key: string
  items: StoredComposerReference[]
  ready: boolean
  error: string
}
export function useComposerReferences({
  userId,
  resourcePath,
  readOnly = false,
  visible = true,
}: {
  userId: string
  resourcePath: string
  visible?: boolean
  readOnly?: boolean
}) {
  const { workspaceId } = useWorkspaceApi()
  const key = composerReferencesKey(userId, workspaceId, resourcePath)
  const sync = useCloudDraft(
    userId,
    key,
    () => localStorage.getItem(key) ?? '',
    (value) => {
      if (value) storedReferencesSchema.parse(JSON.parse(value))
      applyCloudSelection(key, value)
    },
    visible,
  )
  const [state, setState] = useState<State>({
    key,
    items: [],
    ready: false,
    error: '',
  })
  const current = useRef(state)
  const owner = useRef(key)
  owner.current = key
  const mounted = useRef(false)
  const [busy, setBusy] = useState(false)
  const operations = useRef(0)
  const publish = useCallback((next: State) => {
    if (!mounted.current || owner.current !== next.key) return
    current.current = next
    setState(next)
  }, [])
  useEffect(() => {
    mounted.current = true
    const load = () => {
      try {
        publish({
          key,
          items: new ComposerReferenceStore(localStorage, key).read(),
          ready: true,
          error: '',
        })
      } catch {
        publish({
          key,
          items: current.current.key === key ? current.current.items : [],
          ready: false,
          error:
            'Saved references could not be read. Clear them before sending.',
        })
      }
    }
    load()
    const changed = (event: StorageEvent) => {
      if (event.key === key || event.key === null) load()
    }
    window.addEventListener('storage', changed)
    return () => {
      mounted.current = false
      window.removeEventListener('storage', changed)
    }
  }, [key, publish])
  const mutate = async (
    operation: (store: ComposerReferenceStore) => StoredComposerReference[],
    cleanup = false,
  ) => {
    if (!cleanup && (readOnly || owner.current !== key)) return false
    operations.current++
    if (mounted.current && owner.current === key) setBusy(true)
    try {
      if (!navigator.locks)
        throw new Error('Use an up-to-date browser to save references safely.')
      let changed = false
      await navigator.locks.request(key, () => {
        if (!cleanup && (!mounted.current || owner.current !== key)) return
        const items = operation(new ComposerReferenceStore(localStorage, key))
        publish({ key, items, ready: true, error: '' })
        changed = true
      })
      return changed
    } catch (caught) {
      publish({
        key,
        items: current.current.key === key ? current.current.items : [],
        ready: false,
        error:
          caught instanceof Error
            ? caught.message
            : 'References could not be saved. Try again.',
      })
      return false
    } finally {
      operations.current--
      if (mounted.current && owner.current === key)
        setBusy(operations.current > 0)
    }
  }
  const entries = state.key === key ? state.items : []
  return {
    sync,
    items: entries.map((item) => item.reference),
    inputs: entries.map((item) => referenceInput(item.reference)),
    snapshot: captureReferenceSelection(entries),
    valid: state.key === key && state.ready && !state.error && !busy,
    busy,
    error: state.key === key ? state.error : '',
    hasReferences: !!entries.length,
    add: (reference: MessageReference) =>
      mutate((store) => store.add(reference)),
    remove: (reference: ReferenceInput) =>
      mutate((store) => store.remove(referenceKey(reference))),
    clear: () => mutate((store) => store.clear()),
    clearSubmitted: (snapshot: ReferenceSelectionSnapshot = []) =>
      snapshot.length
        ? mutate((store) => store.clearSubmitted(snapshot), true)
        : Promise.resolve(true),
  }
}
export type ComposerReferencesController = ReturnType<
  typeof useComposerReferences
>
