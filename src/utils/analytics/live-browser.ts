import {
  isLivePage,
  liveActionSchema,
  LIVE_HEARTBEAT_MS,
  LIVE_RETENTION_MS,
} from './live'

let report: ((action?: string) => void) | undefined

function trackingAllowed() {
  return (
    navigator.doNotTrack !== '1' &&
    !(
      'globalPrivacyControl' in navigator &&
      navigator.globalPrivacyControl === true
    )
  )
}

export function trackLiveAction(action: string) {
  const parsed = liveActionSchema.safeParse(action)
  if (parsed.success) report?.(parsed.data)
}

export function startLivePresence() {
  if (
    import.meta.env.DEV ||
    import.meta.env.MODE === 'staging' ||
    location.hostname !== 'tanstack.com' ||
    !trackingAllowed()
  )
    return () => {}

  // A session cookie groups tabs, without linking visits to an account or device.
  const cookieName = 'tanstack_live'
  let tabId = crypto.randomUUID()
  let sequence = 0
  let wasOnPublicPage = false

  const send = (kind: 'update' | 'leave', action?: string) => {
    if (!trackingAllowed()) return
    const page = location.pathname
    if (!isLivePage(page)) {
      if (wasOnPublicPage) sendLeave()
      return
    }
    let saved = document.cookie
      .split('; ')
      .find((value) => value.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1)
    const [id, created] = saved?.split('.') ?? []
    if (
      !id ||
      !liveUuid(id) ||
      !created ||
      Date.now() - Number(created) >= LIVE_RETENTION_MS
    )
      saved = `${crypto.randomUUID()}.${Date.now()}`
    document.cookie = `${cookieName}=${saved}; Path=/; SameSite=Lax; Secure; Max-Age=1800`
    if (!document.cookie.split('; ').includes(`${cookieName}=${saved}`)) return
    const sessionId = saved?.split('.')[0]
    if (lastPayload && sessionId !== lastPayload.sessionId) {
      sendLeave()
      tabId = crypto.randomUUID()
      sequence = 0
    }
    const parsedAction = liveActionSchema.safeParse(action)
    const payload = {
      sessionId,
      tabId,
      sequence: ++sequence,
      page,
      visible: document.visibilityState === 'visible',
      kind,
      ...(parsedAction.success ? { action: parsedAction.data } : {}),
    }
    lastPayload = payload
    wasOnPublicPage = kind !== 'leave'
    navigator.sendBeacon(
      '/_a/live',
      new Blob([JSON.stringify(payload)], { type: 'application/json' }),
    )
  }

  let lastPayload:
    | {
        sessionId: string | undefined
        tabId: string
        sequence: number
        page: string
        visible: boolean
        kind: string
      }
    | undefined
  const sendLeave = () => {
    if (!lastPayload || !wasOnPublicPage) return
    navigator.sendBeacon(
      '/_a/live',
      new Blob(
        [
          JSON.stringify({
            ...lastPayload,
            sequence: ++sequence,
            kind: 'leave',
          }),
        ],
        { type: 'application/json' },
      ),
    )
    wasOnPublicPage = false
  }
  report = (action) => send('update', action)
  const onVisibility = () => send('update')
  const onPageShow = () => send('update')
  const timer = setInterval(() => send('update'), LIVE_HEARTBEAT_MS)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', sendLeave)
  window.addEventListener('pageshow', onPageShow)
  send('update')
  return () => {
    sendLeave()
    clearInterval(timer)
    report = undefined
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', sendLeave)
    window.removeEventListener('pageshow', onPageShow)
  }
}

function liveUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
}
