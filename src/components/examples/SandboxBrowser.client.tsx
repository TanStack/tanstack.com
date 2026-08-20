import * as React from 'react'
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowSquareOutIcon,
  CameraIcon,
  CheckIcon,
  CopyIcon,
  CornersOutIcon,
  CursorClickIcon,
  DownloadSimpleIcon,
  DotsThreeIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react'
import {
  Button,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from '~/components/ds/ui'
import { Tooltip } from '~/ui'
import { copyTextToClipboard } from '~/utils/browser-effects'

export type SandboxBrowserAnnotationTarget = {
  rect: {
    height: number
    width: number
    x: number
    y: number
  }
  selector: string
  tagName: string
  text: string
  url: string
}

export function SandboxBrowser({
  annotationAvailable = false,
  annotationMode = false,
  annotationTarget,
  canGoBack,
  canGoForward,
  captureScreenshot,
  children,
  currentUrl,
  error,
  history,
  navigationAvailable = true,
  onAnnotationModeChange,
  onBack,
  onClearAnnotationTarget,
  onForward,
  onNavigate,
  onReload,
  openExternalUrl,
  reloadDisabled = false,
}: {
  annotationAvailable?: boolean
  annotationMode?: boolean
  annotationTarget?: SandboxBrowserAnnotationTarget
  canGoBack: boolean
  canGoForward: boolean
  captureScreenshot?: () => Promise<Blob>
  children?: React.ReactNode
  currentUrl: string
  error?: string
  history: Array<string>
  navigationAvailable?: boolean
  onAnnotationModeChange?: (active: boolean) => void
  onBack(): void
  onClearAnnotationTarget?: () => void
  onForward(): void
  onNavigate(url: string): void
  onReload(): void
  openExternalUrl?: string
  reloadDisabled?: boolean
}) {
  const rootRef = React.useRef<HTMLDivElement>(null)
  const annotationInputRef = React.useRef<HTMLTextAreaElement>(null)
  const [address, setAddress] = React.useState(() =>
    getPreviewAddressPath(currentUrl),
  )
  const [addressFocused, setAddressFocused] = React.useState(false)
  const [annotationNote, setAnnotationNote] = React.useState('')
  const [annotationCopyError, setAnnotationCopyError] = React.useState(false)
  const [capturedScreenshot, setCapturedScreenshot] =
    React.useState<CapturedScreenshot>()
  const [screenshotStatus, setScreenshotStatus] = React.useState<
    'capturing' | 'copied' | 'error' | 'idle'
  >('idle')
  const [copiedUrl, setCopiedUrl] = React.useState(false)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const historyId = React.useId()
  const fullscreenAvailable =
    typeof document !== 'undefined' && document.fullscreenEnabled

  React.useEffect(() => {
    if (!addressFocused) setAddress(getPreviewAddressPath(currentUrl))
  }, [addressFocused, currentUrl])

  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  React.useEffect(
    () => () => {
      if (capturedScreenshot) URL.revokeObjectURL(capturedScreenshot.url)
    },
    [capturedScreenshot],
  )

  React.useEffect(() => {
    setAnnotationNote('')
    setAnnotationCopyError(false)
    annotationInputRef.current?.focus({ preventScroll: true })
  }, [annotationTarget])

  function setCommenting(active: boolean) {
    onAnnotationModeChange?.(active)
  }

  function submitAddress(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = address.trim()
    if (!next) {
      setAddress(getPreviewAddressPath(currentUrl))
      return
    }
    onNavigate(next)
  }

  async function copyUrl() {
    try {
      await copyTextToClipboard(currentUrl)
      setCopiedUrl(true)
      window.setTimeout(() => setCopiedUrl(false), 1500)
    } catch {
      setCopiedUrl(false)
    }
  }

  async function takeScreenshot() {
    if (!captureScreenshot || screenshotStatus === 'capturing') return
    setScreenshotStatus('capturing')
    try {
      const blob = await captureScreenshot()
      setCapturedScreenshot((current) => {
        if (current) URL.revokeObjectURL(current.url)
        return { blob, url: URL.createObjectURL(blob) }
      })
      setScreenshotStatus('idle')
    } catch {
      setScreenshotStatus('error')
    }
  }

  async function copyScreenshot() {
    if (!capturedScreenshot) return
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': capturedScreenshot.blob }),
      ])
      setScreenshotStatus('copied')
      window.setTimeout(() => setScreenshotStatus('idle'), 1500)
    } catch {
      setScreenshotStatus('error')
    }
  }

  function downloadScreenshot() {
    if (!capturedScreenshot) return
    const link = document.createElement('a')
    link.download = 'sandbox-preview.png'
    link.href = capturedScreenshot.url
    link.click()
  }

  function closeScreenshot() {
    setCapturedScreenshot((current) => {
      if (current) URL.revokeObjectURL(current.url)
      return undefined
    })
    setScreenshotStatus('idle')
  }

  async function copyAnnotation() {
    if (!annotationTarget) return
    try {
      await copyTextToClipboard(
        formatAnnotation(annotationTarget, annotationNote.trim()),
      )
      onClearAnnotationTarget?.()
    } catch {
      setAnnotationCopyError(true)
    }
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === rootRef.current) {
        await document.exitFullscreen()
        return
      }
      await rootRef.current?.requestFullscreen()
    } catch {
      // Fullscreen support can change with browser policy and embedding.
    }
  }

  const toolbarAction = (
    label: string,
    icon: React.ReactNode,
    action: () => void,
    disabled = false,
  ) => (
    <Tooltip content={label} side="bottom">
      <Button
        type="button"
        variant="icon"
        color="gray"
        size="icon-sm"
        rounded="md"
        className="shrink-0 bg-transparent text-text-muted transition-none hover:bg-surface-state-hover hover:text-text-primary active:scale-100 disabled:hover:bg-transparent disabled:hover:text-text-muted max-[899px]:bg-transparent max-[899px]:text-text-muted max-[899px]:hover:bg-surface-state-hover max-[899px]:hover:text-text-primary"
        aria-label={label}
        disabled={disabled}
        onClick={action}
      >
        {icon}
      </Button>
    </Tooltip>
  )

  return (
    <div
      ref={rootRef}
      data-sandbox-browser=""
      className="sandbox-ui relative grid size-full min-h-0 grid-rows-[2.5rem_minmax(0,1fr)] bg-background-default min-[900px]:grid-rows-[2.25rem_minmax(0,1fr)]"
    >
      <header className="flex min-w-0 items-center gap-1 border-b border-border-default bg-background-subtle px-1.5">
        {toolbarAction(
          'Back',
          <ArrowLeftIcon className="size-3.5" aria-hidden="true" />,
          onBack,
          !canGoBack,
        )}
        {toolbarAction(
          'Forward',
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />,
          onForward,
          !canGoForward,
        )}
        {toolbarAction(
          'Reload preview',
          <ArrowClockwiseIcon className="size-3.5" aria-hidden="true" />,
          onReload,
          !navigationAvailable || reloadDisabled,
        )}

        <form
          className="mx-1 flex min-w-0 flex-1 items-center"
          onSubmit={submitAddress}
        >
          <label className="flex h-7 min-w-0 flex-1 items-center rounded-lg border border-transparent bg-transparent px-2 text-text-muted hover:border-border-default hover:bg-input-bg-hover focus-within:border-border-focus focus-within:bg-input-bg-hover focus-within:ring-2 focus-within:ring-border-focus/30 focus-within:hover:border-border-focus">
            <span className="sr-only">Preview address</span>
            <span
              aria-hidden="true"
              className="shrink-0 select-none font-ds-mono text-[11px] text-text-muted"
            >
              localhost:3000
            </span>
            <input
              type="text"
              value={address}
              list={history.length > 1 ? historyId : undefined}
              readOnly={!navigationAvailable}
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              onBlur={() => setAddressFocused(false)}
              onChange={(event) => setAddress(event.target.value)}
              onFocus={() => setAddressFocused(true)}
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                setAddress(getPreviewAddressPath(currentUrl))
                event.currentTarget.blur()
              }}
              className="min-w-0 flex-1 truncate bg-transparent font-ds-mono text-[11px] text-text-secondary outline-none read-only:cursor-default"
            />
          </label>
          {history.length > 1 ? (
            <datalist id={historyId}>
              {history.map((url) => (
                <option key={url} value={getPreviewAddressPath(url)} />
              ))}
            </datalist>
          ) : null}
        </form>

        {annotationAvailable ? (
          <Tooltip
            content={annotationMode ? 'Stop commenting' : 'Comment on preview'}
            side="bottom"
          >
            <Button
              type="button"
              variant={annotationMode ? 'primary' : 'icon'}
              color={annotationMode ? 'blue' : 'gray'}
              size="icon-sm"
              rounded="md"
              className={`${annotationMode ? '' : 'bg-transparent text-text-muted hover:bg-surface-state-hover hover:text-text-primary max-[899px]:bg-transparent max-[899px]:text-text-muted max-[899px]:hover:bg-surface-state-hover max-[899px]:hover:text-text-primary'} hidden shrink-0 transition-none hover:translate-y-0 active:scale-100 sm:inline-flex`}
              aria-label={
                annotationMode ? 'Stop commenting' : 'Comment on preview'
              }
              aria-pressed={annotationMode}
              onClick={() => setCommenting(!annotationMode)}
            >
              <CursorClickIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </Tooltip>
        ) : null}

        <Dropdown>
          <DropdownTrigger
            render={
              <Button
                type="button"
                variant="icon"
                color="gray"
                size="icon-sm"
                rounded="md"
                className="shrink-0 bg-transparent text-text-muted transition-none hover:bg-surface-state-hover hover:text-text-primary active:scale-100 max-[899px]:bg-transparent max-[899px]:text-text-muted max-[899px]:hover:bg-surface-state-hover max-[899px]:hover:text-text-primary"
                aria-label="Preview actions"
              >
                <DotsThreeIcon className="size-3.5" aria-hidden="true" />
              </Button>
            }
          />
          <DropdownContent
            align="end"
            container={isFullscreen ? rootRef.current : undefined}
            side="bottom"
            sideOffset={5}
            className="sandbox-ui border-black/10 dark:border-white/10"
          >
            <DropdownItem onSelect={() => void copyUrl()}>
              {copiedUrl ? (
                <CheckIcon className="size-4" aria-hidden="true" />
              ) : (
                <CopyIcon className="size-4" aria-hidden="true" />
              )}
              {copiedUrl ? 'Copied address' : 'Copy address'}
            </DropdownItem>
            {openExternalUrl ? (
              <DropdownItem
                render={
                  <a
                    href={openExternalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ArrowSquareOutIcon className="size-4" aria-hidden="true" />
                    Open in new tab
                  </a>
                }
              />
            ) : null}
            {captureScreenshot ? (
              <DropdownItem onSelect={() => void takeScreenshot()}>
                <CameraIcon className="size-4" aria-hidden="true" />
                {screenshotStatus === 'capturing'
                  ? 'Capturing…'
                  : 'Capture screenshot'}
              </DropdownItem>
            ) : null}
            {annotationAvailable ? (
              <DropdownItem onSelect={() => setCommenting(!annotationMode)}>
                <CursorClickIcon className="size-4" aria-hidden="true" />
                {annotationMode ? 'Stop commenting' : 'Comment on preview'}
              </DropdownItem>
            ) : null}
            {fullscreenAvailable ? (
              <DropdownItem onSelect={() => void toggleFullscreen()}>
                <CornersOutIcon className="size-4" aria-hidden="true" />
                {isFullscreen ? 'Exit full screen' : 'Full screen'}
              </DropdownItem>
            ) : null}
          </DropdownContent>
        </Dropdown>
      </header>

      <div className="relative min-h-0 overflow-hidden">{children}</div>

      {error ? (
        <div
          className="absolute top-12 right-3 left-3 z-20 flex max-h-48 items-start gap-2 overflow-hidden rounded-md border border-border-default bg-background-surface px-2.5 py-2 shadow-sm sm:left-auto sm:w-[26rem] min-[900px]:top-11"
          role="group"
          aria-label="Preview error"
        >
          <span className="sr-only" role="alert">
            Preview failed. Error details are shown.
          </span>
          <WarningCircleIcon
            className="mt-0.5 size-4 shrink-0 text-icon-error"
            aria-hidden="true"
          />
          <pre
            className="min-h-0 min-w-0 overflow-auto font-ds-mono text-xs/5 whitespace-pre-wrap text-text-secondary"
            aria-label="Preview error details"
          >
            {error}
          </pre>
        </div>
      ) : null}

      {annotationTarget ? (
        <div
          role="dialog"
          aria-label="Comment on preview"
          className="absolute right-3 bottom-3 z-20 w-[min(22rem,calc(100%-1.5rem))] rounded-xl border border-border-default bg-background-elevated p-3 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-ds-mono text-xs text-text-primary">
                {annotationTarget.selector ||
                  annotationTarget.tagName.toLowerCase()}
              </div>
              {annotationTarget.text ? (
                <div className="mt-1 line-clamp-2 text-xs text-text-muted">
                  {annotationTarget.text}
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="icon"
              color="gray"
              size="icon-sm"
              rounded="md"
              className="shrink-0 transition-none active:scale-100"
              aria-label="Cancel comment"
              onClick={onClearAnnotationTarget}
            >
              <XIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
          <label className="mt-3 block">
            <span className="sr-only">Describe this change</span>
            <textarea
              ref={annotationInputRef}
              value={annotationNote}
              rows={3}
              maxLength={2_000}
              placeholder="Describe this change…"
              onChange={(event) => setAnnotationNote(event.target.value)}
              className="w-full resize-none rounded-lg border border-border-default bg-background-default px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-border-focus focus:ring-2 focus:ring-border-focus/30"
            />
          </label>
          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              color="gray"
              size="xs"
              onClick={onClearAnnotationTarget}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              color="blue"
              size="xs"
              disabled={!annotationNote.trim()}
              onClick={() => void copyAnnotation()}
            >
              <CopyIcon className="size-3.5" aria-hidden="true" />
              Copy comment
            </Button>
          </div>
          {annotationCopyError ? (
            <p className="mt-2 text-xs text-text-secondary" role="alert">
              Unable to copy comment.
            </p>
          ) : null}
        </div>
      ) : null}

      {capturedScreenshot ? (
        <div className="absolute right-3 bottom-3 z-20 w-56 rounded-xl border border-border-default bg-background-elevated p-2 shadow-xl">
          <img
            src={capturedScreenshot.url}
            alt="Captured preview"
            className="aspect-video w-full rounded-lg bg-background-subtle object-contain"
          />
          <div className="mt-2 flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              color="gray"
              size="xs"
              className="flex-1"
              onClick={() => void copyScreenshot()}
            >
              {screenshotStatus === 'copied' ? (
                <CheckIcon className="size-3.5" aria-hidden="true" />
              ) : (
                <CopyIcon className="size-3.5" aria-hidden="true" />
              )}
              {screenshotStatus === 'copied' ? 'Copied' : 'Copy'}
            </Button>
            <Tooltip content="Download screenshot" side="top">
              <Button
                type="button"
                variant="icon"
                color="gray"
                size="icon-sm"
                rounded="md"
                aria-label="Download screenshot"
                onClick={downloadScreenshot}
              >
                <DownloadSimpleIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </Tooltip>
            <Tooltip content="Close screenshot" side="top">
              <Button
                type="button"
                variant="icon"
                color="gray"
                size="icon-sm"
                rounded="md"
                aria-label="Close screenshot"
                onClick={closeScreenshot}
              >
                <XIcon className="size-3.5" aria-hidden="true" />
              </Button>
            </Tooltip>
          </div>
          {screenshotStatus === 'error' ? (
            <p className="mt-2 text-xs text-text-secondary" role="alert">
              Unable to copy screenshot. Download is still available.
            </p>
          ) : null}
        </div>
      ) : screenshotStatus === 'error' ? (
        <div
          className="absolute right-3 bottom-3 z-20 flex items-center gap-2 rounded-md border border-border-default bg-background-surface py-1.5 pr-1.5 pl-2.5 text-xs text-text-secondary shadow-sm"
          role="alert"
        >
          <WarningCircleIcon
            className="size-3.5 shrink-0 text-icon-error"
            aria-hidden="true"
          />
          Screenshot unavailable for this preview.
          <Button
            type="button"
            variant="icon"
            color="gray"
            size="icon-sm"
            rounded="md"
            aria-label="Dismiss screenshot error"
            onClick={() => setScreenshotStatus('idle')}
          >
            <XIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function getPreviewAddressPath(url: string) {
  if (url.startsWith('/') || url.startsWith('#')) return url
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return url
  }
}

type CapturedScreenshot = {
  blob: Blob
  url: string
}

function formatAnnotation(
  target: SandboxBrowserAnnotationTarget,
  note: string,
) {
  const excerpt = target.text ? `\nText: ${target.text}` : ''
  const rect = `${Math.round(target.rect.x)},${Math.round(target.rect.y)} ${Math.round(target.rect.width)}×${Math.round(target.rect.height)}`
  return `${note}\n\nPreview: ${target.url}\nElement: ${target.selector || target.tagName.toLowerCase()}\nBounds: ${rect}${excerpt}`
}
