import { canonicalCopyJson } from './conversation-copy'
import { referenceInput } from './message-references'
import type { NewSend } from './send-receipt'
import {
  RetryDraftStore,
  retryDraftContentSchema,
  type RetryDraftContent,
  type RetryDraftDocument,
  type RetryDraftSeed,
  type RetryDraftConsumption,
} from './retry-draft'

export interface RetryDraftEditorState {
  ready: boolean
  document: RetryDraftDocument | null
  draft: RetryDraftContent | null
  dirty: boolean
  saving: boolean
  error: string
  conflict: RetryDraftDocument | null
}
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'The draft could not be saved.'
const same = (a: unknown, b: unknown) =>
  canonicalCopyJson(a) === canonicalCopyJson(b)

/** Create the immutable send input only from a fully saved editor revision. */
export function retryDraftSendInput(document: RetryDraftDocument): NewSend {
  const draft = retryDraftContentSchema.parse(document.draft)
  if (document.consumed) throw new Error('This retry was already sent.')
  if (draft.pendingAttachments?.length)
    throw new Error('Finish or remove unfinished uploads before sending.')
  if (
    !draft.text.trim() &&
    !draft.attachments.length &&
    !draft.references.some((reference) => reference.kind === 'file')
  )
    throw new Error('Write a request or attach a file before sending.')
  return {
    text: draft.text,
    fileIds: draft.attachments.map((file) => file.id),
    references: draft.references.map(referenceInput),
    runModel: draft.runModel,
    proposeToolsOnly: false,
    refreshCatalog: false,
    systemOne: false,
    delivery: 'queue',
    retry: {
      attemptId: document.seed.attemptId,
      draftRevision: document.revision,
    },
  }
}

/** A completed save can allow navigation, an unsaved local buffer cannot. */
export async function retryDraftBlocksNavigation(editor: RetryDraftEditor) {
  if (!editor.snapshot().dirty && !editor.snapshot().saving) return false
  await editor.flush()
  return editor.snapshot().dirty || editor.snapshot().saving
}

/** Optimistic editor with serialized saves. Failed and stale writes retain the
 * person's local buffer until they explicitly choose which draft to keep.
 */
export class RetryDraftEditor {
  private state: RetryDraftEditorState = {
    ready: false,
    document: null,
    draft: null,
    dirty: false,
    saving: false,
    error: '',
    conflict: null,
  }
  private listeners = new Set<() => void>()
  private tail: Promise<unknown> = Promise.resolve()
  private generation = 0
  private outstanding = 0
  private resolving = false
  constructor(readonly store: RetryDraftStore) {}
  snapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  private publish(change: Partial<RetryDraftEditorState>) {
    this.state = { ...this.state, ...change }
    for (const listener of this.listeners) listener()
  }
  async load(seed?: RetryDraftSeed) {
    try {
      await this.tail
      const document = seed
        ? await this.store.adoptRetrySeed(seed)
        : this.store.read()
      this.external(document)
      this.publish({
        ready: true,
        ...(!this.state.dirty && same(document, this.state.document)
          ? { error: '' }
          : {}),
      })
    } catch (error) {
      this.publish({ ready: true, error: errorText(error) })
    }
  }
  private external(document: RetryDraftDocument | null) {
    if (same(document, this.state.document)) return
    if (this.state.dirty || this.outstanding) {
      this.publish({
        conflict: document,
        error: 'This draft changed in another view. Your edits are still here.',
      })
      return
    }
    this.publish({
      document,
      draft: document?.draft ?? null,
      dirty: false,
      error: '',
      conflict: null,
    })
  }
  async refresh() {
    await this.tail
    try {
      this.external(this.store.read())
    } catch (error) {
      this.publish({ error: errorText(error) })
    }
  }
  change(
    update: (draft: RetryDraftContent) => RetryDraftContent,
  ): Promise<boolean> {
    const current = this.state
    if (!current.ready || !current.draft || current.document?.consumed)
      return Promise.resolve(false)
    let next: RetryDraftContent
    try {
      next = retryDraftContentSchema.parse(update(current.draft))
    } catch (error) {
      this.publish({ error: errorText(error) })
      return Promise.resolve(false)
    }
    const generation = ++this.generation
    this.publish({ draft: next, dirty: true })
    if (current.error || this.resolving) return Promise.resolve(false)
    this.outstanding++
    this.publish({ saving: true })
    const task = this.tail
      .then(async () => {
        if (this.state.error || !this.state.document) return false
        try {
          const saved = await this.store.update(
            this.state.document.revision,
            next,
          )
          this.publish({
            document: saved,
            ...(generation === this.generation
              ? { draft: saved.draft, dirty: false }
              : {}),
            conflict: null,
          })
          return true
        } catch (error) {
          let conflict: RetryDraftDocument | null = null
          try {
            conflict = this.store.read()
          } catch {
            /* Preserve the local buffer. */
          }
          this.publish({ error: errorText(error), conflict })
          return false
        }
      })
      .finally(() => {
        this.outstanding--
        this.publish({ saving: this.outstanding > 0 })
      })
    this.tail = task
    return task
  }
  async flush(): Promise<RetryDraftDocument | null> {
    await this.tail
    return this.state.ready &&
      !this.state.error &&
      !this.state.dirty &&
      !this.state.document?.consumed
      ? this.state.document
      : null
  }
  /** Explicit conflict resolution. No automatic merge can discard either draft. */
  async keepLocal() {
    if (this.resolving) return false
    this.resolving = true
    await this.tail
    const draft = this.state.draft
    if (!draft) {
      this.resolving = false
      return false
    }
    const task = (async () => {
      try {
        const current = this.store.read()
        if (!current || current.consumed)
          throw new Error(
            'This retry is no longer editable. Your local edits are still here.',
          )
        const generation = this.generation
        this.publish({ saving: true })
        const saved = await this.store.update(current.revision, draft)
        this.publish({
          document: saved,
          ...(generation === this.generation
            ? { draft: saved.draft, dirty: false }
            : {}),
          error: '',
          conflict: null,
        })
        return true
      } catch (error) {
        this.publish({ error: errorText(error) })
        return false
      } finally {
        this.publish({ saving: false })
      }
    })()
    this.tail = task
    const saved = await task
    this.resolving = false
    // Typing during the explicit save is another local revision. Persist that
    // buffer too before claiming the editor is caught up.
    if (saved && this.state.dirty && !this.state.error)
      return this.change((value) => value)
    return saved
  }
  async useSaved() {
    await this.tail
    try {
      const document = this.store.read()
      if (!document) throw new Error('The saved retry draft is unavailable.')
      this.generation++
      this.publish({
        document,
        draft: document.draft,
        dirty: false,
        saving: false,
        error: '',
        conflict: null,
      })
      return true
    } catch (error) {
      this.publish({ error: errorText(error) })
      return false
    }
  }
  async consume(accepted: RetryDraftConsumption) {
    await this.tail
    if (this.state.dirty) {
      const error = new Error(
        'Your request was accepted, but later edits are not saved. Save or review those edits before continuing.',
      )
      this.publish({ error: error.message })
      throw error
    }
    const persisted = this.store.read()
    if (!persisted) return null
    const consumed = await this.store.consume(accepted)
    const later = this.state.dirty || consumed.revision > accepted.draftRevision
    this.publish({
      document: consumed,
      ...(this.state.dirty ? {} : { draft: consumed.draft }),
      ...(later ? {} : { error: '', conflict: null }),
    })
    if (this.state.dirty) {
      const error = new Error(
        'Your request was accepted, but later edits are not saved. Copy or download them, or use the saved draft before continuing.',
      )
      this.publish({ error: error.message, conflict: consumed })
      throw error
    }
    return consumed
  }
}
