import { useRef, useState, type ReactNode } from 'react'
import { File as FileIcon, Paperclip, RotateCw, X } from 'lucide-react'
import { IconButton } from './IconButton'
import { SketchPad } from './SketchPad'
import type { RunModelController } from './useRunModel'
import {
  maxComposerAttachments,
  type ComposerAttachmentsController,
} from './useComposerAttachments'
import './composer-attachments.css'

export function composerSketchDisabledReason({
  readOnly = false,
  locked = false,
  assistantMode = true,
  fileCount,
  model,
}: {
  readOnly?: boolean
  locked?: boolean
  assistantMode?: boolean
  fileCount: number
  model: Pick<RunModelController, 'valid' | 'loading' | 'error' | 'choice'>
}): string | undefined {
  if (readOnly) return 'This conversation is read-only.'
  if (locked) return 'Finish the pending send before attaching a sketch.'
  if (!assistantMode) return 'Switch to Assistant mode to attach a sketch.'
  if (fileCount >= maxComposerAttachments)
    return 'Remove a file before attaching a sketch. The limit is 5.'
  if (model.loading) return 'Loading model support…'
  if (!model.valid)
    return model.error || 'Choose an available model to attach a sketch.'
  if (!model.choice?.attachments.includes('image'))
    return 'Choose a model that supports images to attach a sketch.'
}

export function ComposerAttachments({
  attachments,
  disabled = false,
  hidden = false,
  sketchDisabledReason,
  renderPicker,
}: {
  attachments: Pick<
    ComposerAttachmentsController,
    | 'items'
    | 'scopeKey'
    | 'error'
    | 'addFiles'
    | 'addGeneratedFile'
    | 'remove'
    | 'retry'
  >
  disabled?: boolean
  /** Keep a local drawing mounted while an immutable send is being resolved. */
  hidden?: boolean
  sketchDisabledReason?: string
  renderPicker?: (choose: () => void, chooseSketch: () => void) => ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const retryId = useRef<string | undefined>(undefined)
  const [sketch, setSketch] = useState<{ scopeKey: string; open: boolean }>()
  const current = useRef({
    attachments,
    disabled,
    hidden,
    sketchDisabledReason,
  })
  current.current = { attachments, disabled, hidden, sketchDisabledReason }
  const choose = (id?: string) => {
    retryId.current = id
    input.current?.click()
  }
  return (
    <div
      className="composer-attachments"
      style={hidden ? { display: 'none' } : undefined}
    >
      <input
        ref={input}
        type="file"
        hidden
        multiple
        disabled={disabled}
        onChange={(event) => {
          if (event.target.files)
            attachments.addFiles(event.target.files, retryId.current)
          retryId.current = undefined
          event.target.value = ''
        }}
      />
      {renderPicker ? (
        renderPicker(
          () => choose(),
          () => {
            if (!disabled && !sketchDisabledReason)
              setSketch({ scopeKey: attachments.scopeKey, open: true })
          },
        )
      ) : (
        <IconButton
          label="Attach files"
          disabled={
            disabled || attachments.items.length >= maxComposerAttachments
          }
          onClick={() => choose()}
        >
          <Paperclip size={17} aria-hidden />
        </IconButton>
      )}
      {!!attachments.items.length && (
        <ul
          className="composer-attachment-list"
          aria-label="Message attachments"
        >
          {attachments.items.map((item) => (
            <li key={item.id} data-status={item.status}>
              <FileIcon size={15} aria-hidden />
              <div className="composer-attachment-info">
                <span className="composer-attachment-name" title={item.name}>
                  {item.name}
                </span>
                {item.status === 'uploading' && (
                  <span className="composer-attachment-status" role="status">
                    {item.phase === 'checking' ? 'Checking…' : 'Uploading…'}
                  </span>
                )}
                {item.status === 'error' && (
                  <span className="composer-attachment-error" role="alert">
                    {item.error || 'Upload unfinished.'}
                  </span>
                )}
              </div>
              {item.status === 'error' && (
                <IconButton
                  label={`${item.needsFile ? 'Choose original file for' : 'Retry'} ${item.name}`}
                  disabled={disabled}
                  onClick={() =>
                    item.needsFile
                      ? choose(item.id)
                      : attachments.retry(item.id)
                  }
                >
                  <RotateCw size={14} aria-hidden />
                </IconButton>
              )}
              <IconButton
                label={`Remove attachment ${item.name}`}
                disabled={disabled}
                onClick={() => attachments.remove(item.id)}
              >
                <X size={14} aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {attachments.error && (
        <p
          className="composer-attachment-error composer-attachment-error-global"
          role="alert"
        >
          {attachments.error}
        </p>
      )}
      {sketch?.scopeKey === attachments.scopeKey && (
        <SketchPad
          key={attachments.scopeKey}
          open={sketch.open && !hidden}
          onOpenChange={(open) =>
            setSketch({ scopeKey: attachments.scopeKey, open })
          }
          disabledReason={
            disabled
              ? 'Finish the pending send before attaching a sketch.'
              : sketchDisabledReason
          }
          onAttach={(file) => {
            // Export is asynchronous. Recheck the current owner and controls
            // before admitting its bytes to the ordinary upload flow.
            const allowed = () => {
              const latest = current.current
              return (
                latest.attachments.scopeKey === attachments.scopeKey &&
                !latest.disabled &&
                !latest.hidden &&
                !latest.sketchDisabledReason
              )
            }
            if (!allowed()) return false
            return current.current.attachments.addGeneratedFile(file, allowed)
          }}
        />
      )}
    </div>
  )
}
