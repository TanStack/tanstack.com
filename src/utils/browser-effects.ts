import * as React from 'react'
import { trackScarfClipboardText } from '~/utils/analytics/scarf'

// Analytics must never turn a successful copy into a failure.
function trackClipboardCopy(text: string) {
  try {
    trackScarfClipboardText('copy', text)
  } catch {
    // ignore analytics failures
  }
}

export async function copyTextToClipboard(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(value)
      trackClipboardCopy(value)
      return
    } catch {
      // Fall back for restricted contexts where the Clipboard API exists but rejects.
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard unavailable')
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'

  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  let didCopy = false

  try {
    didCopy = document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }

  if (!didCopy) {
    throw new Error('Copy failed')
  }
}

/**
 * Copies text that is still being produced (e.g. fetched over the network).
 *
 * The clipboard write is started synchronously, before the text is ready, so it
 * stays tied to the user gesture that triggered it. WebKit (iOS Safari) rejects
 * clipboard writes made after an await has consumed the user activation.
 */
export function copyTextPromiseToClipboard(
  textPromise: Promise<string>,
): Promise<string> {
  const fallback = async () => {
    const text = await textPromise
    await copyTextToClipboard(text)
    return text
  }

  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== 'function' ||
    typeof ClipboardItem === 'undefined'
  ) {
    return fallback()
  }

  let writePromise: Promise<void>
  try {
    const blobPromise = textPromise.then(
      (text) => new Blob([text], { type: 'text/plain' }),
    )
    // Avoid an unhandled rejection if the browser never consumes the blob.
    blobPromise.catch(() => {})
    writePromise = navigator.clipboard.write([
      new ClipboardItem({ 'text/plain': blobPromise }),
    ])
  } catch {
    return fallback()
  }

  return writePromise.then(
    async () => {
      const text = await textPromise
      trackClipboardCopy(text)
      return text
    },
    // Promise-based ClipboardItem unsupported or rejected: try the text path.
    fallback,
  )
}

export function openPopupWindow(
  url: string,
  target = '_blank',
  features?: string,
) {
  if (typeof window === 'undefined') {
    return null
  }

  return window.open(url, target, features)
}

export function openCenteredPopupWindow({
  features,
  height,
  target,
  url,
  width,
}: {
  features?: Array<string>
  height: number
  target: string
  url: string
  width: number
}) {
  if (typeof window === 'undefined') {
    return null
  }

  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2
  const featureList = [
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    ...(features ?? []),
  ].join(',')

  return openPopupWindow(url, target, featureList)
}

export function useTemporaryFlag(defaultDurationMs = 2000) {
  const [active, setActive] = React.useState(false)
  const timeoutRef = React.useRef<number | null>(null)

  const clearTimer = React.useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const trigger = React.useCallback(
    (durationMs = defaultDurationMs) => {
      clearTimer()

      setActive(true)
      timeoutRef.current = window.setTimeout(() => {
        setActive(false)
        timeoutRef.current = null
      }, durationMs)
    },
    [clearTimer, defaultDurationMs],
  )

  React.useEffect(() => clearTimer, [clearTimer])

  return { active, trigger }
}
