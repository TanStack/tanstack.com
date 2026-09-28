import type { AnalyticsProvider } from './types'

const SCARF_ENDPOINT = 'https://tanstack.gateway.scarf.sh/site-events'
const CLIPBOARD_TEXT_LIMIT = 512

function sendScarfEvent(event: string, fields: Record<string, string>) {
  if (import.meta.env.DEV || typeof window === 'undefined') {
    return
  }

  const url = new URL(SCARF_ENDPOINT)
  url.searchParams.set('event', event)

  for (const [key, value] of Object.entries(fields)) {
    url.searchParams.set(key, value)
  }

  // A beacon can finish even when an outbound click unloads the page.
  navigator.sendBeacon(url)
}

export const scarfAnalyticsProvider: AnalyticsProvider = {
  trackEvent(event, properties) {
    if (typeof window === 'undefined') return

    if (event === 'application_starter_generated') {
      sendScarfEvent(event, {
        page: window.location.pathname,
        package_manager: String(properties.final_package_manager),
        library_count: String(properties.final_library_count),
        partner_count: String(properties.final_partner_count),
      })
    } else if (event === 'application_starter_activated') {
      sendScarfEvent(event, {
        page: window.location.pathname,
        action: String(properties.action),
        surface: String(properties.surface),
        automatic: String(properties.automatic),
        ...(properties.provider
          ? { provider: String(properties.provider) }
          : {}),
      })
    } else if (event === 'partner_inquiry_started') {
      sendScarfEvent(event, {
        page: window.location.pathname,
        placement: String(properties.placement),
      })
    }
  },
}

export function trackScarfInstallCommandCopy(
  packageManager: string,
  framework: string,
  packages: string,
) {
  sendScarfEvent('install_command_copied', {
    page: window.location.pathname,
    package_manager: packageManager,
    framework,
    packages,
  })
}

export function trackScarfPageView(page: string) {
  sendScarfEvent('page_view', { page })
}

export function trackScarfClipboardText(event: 'copy' | 'paste', text: string) {
  if (import.meta.env.DEV) return

  try {
    navigator.sendBeacon(
      '/_a/scarf/clipboard',
      new Blob(
        [
          JSON.stringify({
            event,
            page: window.location.pathname,
            text: text.slice(0, CLIPBOARD_TEXT_LIMIT),
            truncated: text.length > CLIPBOARD_TEXT_LIMIT,
          }),
        ],
        { type: 'application/json' },
      ),
    )
  } catch {
    // Clipboard tracking must not affect copying or pasting.
  }
}

export function trackScarfClipboardEvent(event: ClipboardEvent) {
  const target = event.target
  if (target instanceof HTMLInputElement && target.type === 'password') return

  let text = ''
  if (event.type === 'paste') {
    text = event.clipboardData?.getData('text/plain') ?? ''
  } else if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    text = target.value.slice(
      target.selectionStart ?? 0,
      target.selectionEnd ?? 0,
    )
  } else {
    text = document.getSelection()?.toString() ?? ''
  }

  if (event.type === 'copy' || event.type === 'paste') {
    trackScarfClipboardText(event.type, text)
  }
}

export function trackScarfDownloadClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element)) return

  const link = target.closest('a[download]')
  if (!link) return

  sendScarfEvent('download_requested', { page: window.location.pathname })
}

function getExternalLinkDestination(link: HTMLAnchorElement) {
  const destination = new URL(link.href, window.location.href)
  if (
    !['http:', 'https:'].includes(destination.protocol) ||
    destination.origin === window.location.origin
  ) {
    return null
  }

  return `${destination.origin}${destination.pathname}`
}

export function trackScarfExternalLinkClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element)) return

  const link = target.closest('a[href]')
  if (!(link instanceof HTMLAnchorElement)) return

  const destination = getExternalLinkDestination(link)
  if (!destination) return

  sendScarfEvent('external_link_click', {
    page: window.location.pathname,
    destination,
  })
}

export function trackScarfExternalLinkHoverIntent() {
  let hoveredLink: HTMLAnchorElement | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const cancelHover = () => {
    clearTimeout(timer)
    hoveredLink = null
  }

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || !(event.target instanceof Element)) {
      return
    }

    const link = event.target.closest('a[href]')
    if (!(link instanceof HTMLAnchorElement) || link === hoveredLink) return

    const destination = getExternalLinkDestination(link)
    if (!destination) return

    clearTimeout(timer)
    hoveredLink = link
    const page = window.location.href
    const navigationKey = window.history.state?.key
    timer = setTimeout(() => {
      if (
        !link.isConnected ||
        document.visibilityState !== 'visible' ||
        window.location.href !== page ||
        window.history.state?.key !== navigationKey ||
        getExternalLinkDestination(link) !== destination
      ) {
        cancelHover()
        return
      }

      sendScarfEvent('external_link_hover_intent', {
        page: window.location.pathname,
        destination,
      })
    }, 350)
  }

  const onPointerOut = (event: PointerEvent) => {
    if (
      hoveredLink &&
      event.target instanceof Node &&
      hoveredLink.contains(event.target) &&
      !(
        event.relatedTarget instanceof Node &&
        hoveredLink.contains(event.relatedTarget)
      )
    ) {
      cancelHover()
    }
  }

  document.addEventListener('pointerover', onPointerOver, true)
  document.addEventListener('pointerout', onPointerOut, true)
  document.addEventListener('visibilitychange', cancelHover)
  window.addEventListener('blur', cancelHover)
  window.addEventListener('pagehide', cancelHover)
  window.addEventListener('popstate', cancelHover)

  return () => {
    cancelHover()
    document.removeEventListener('pointerover', onPointerOver, true)
    document.removeEventListener('pointerout', onPointerOut, true)
    document.removeEventListener('visibilitychange', cancelHover)
    window.removeEventListener('blur', cancelHover)
    window.removeEventListener('pagehide', cancelHover)
    window.removeEventListener('popstate', cancelHover)
  }
}
