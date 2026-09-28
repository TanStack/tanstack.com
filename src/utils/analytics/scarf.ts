import type { AnalyticsProvider } from './types'

const SCARF_ENDPOINT = 'https://tanstack.gateway.scarf.sh/site-events'

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
        ...(properties.provider ? { provider: String(properties.provider) } : {}),
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

export function trackScarfClipboardEvent(event: ClipboardEvent) {
  sendScarfEvent(event.type, { page: window.location.pathname })
}

export function trackScarfDownloadClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element)) return

  const link = target.closest('a[download]')
  if (!link) return

  sendScarfEvent('download_requested', { page: window.location.pathname })
}

export function trackScarfExternalLinkClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element)) return

  const link = target.closest('a[href]')
  if (!(link instanceof HTMLAnchorElement)) return

  const destination = new URL(link.href, window.location.href)
  if (
    !['http:', 'https:'].includes(destination.protocol) ||
    destination.origin === window.location.origin
  ) {
    return
  }

  sendScarfEvent('external_link_click', {
    page: window.location.pathname,
    destination: `${destination.origin}${destination.pathname}`,
  })
}
