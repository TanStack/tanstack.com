// Reviewed 2026-10-19. Update monthly and revalidate the cohort after changes.
export const TRAFFIC_QUALITY_CONFIG = { currentChromeMajor: 155, versionGap: 7 }

export function classifyTraffic(
  input: {
    userAgent: string
    referrer: string
    url: string
    sessionNumber: unknown
  },
  config = TRAFFIC_QUALITY_CONFIG,
) {
  if (input.sessionNumber !== 1 && input.sessionNumber !== '1') {
    return Number(input.sessionNumber) > 1 ? 'unflagged' : 'unknown'
  }
  const url = new URL(input.url)
  if (
    input.referrer ||
    [...url.searchParams.keys()].some(
      (key) =>
        /^utm_/i.test(key) ||
        /^(gclid|dclid|gbraid|wbraid|msclkid|fbclid|_gl)$/i.test(key),
    )
  )
    return 'unflagged'
  const ua = input.userAgent
  // Chrome's reduced version is normal. Only the complete conjunction is flagged.
  if (/Edg\/|OPR\/|SamsungBrowser\/|Android|CrOS|CriOS\//.test(ua))
    return 'unflagged'
  const chrome = /(?:Chrome|HeadlessChrome)\/(\d+)\.0\.0\.0(?:\s|$)/.exec(ua)
  if (
    !chrome ||
    Number(chrome[1]) > config.currentChromeMajor - config.versionGap
  )
    return 'unflagged'
  if (/Windows NT|X11;.*Linux|Linux x86_64/.test(ua)) return 'automated'
  if (/Macintosh;.*Mac OS X/.test(ua)) return 'suspect'
  return 'unflagged'
}

// Inline source stays independent of bundler-generated function helpers.
const INSTALL_TRAFFIC_QUALITY = `function installTrafficQuality(id, classify, config) {
  const send = window.gtag
  if (!send) return
  const entry = {
    userAgent: navigator.userAgent,
    referrer: document.referrer,
    url: location.href,
  }
  let diagnosedSession = ''
  let pending = []
  let resolving = false
  send('set', { traffic_quality: 'unknown', traffic_quality_rule: 'v1' })
  window.gtag = (...args) => {
    if (args[0] !== 'event') {
      send(...args)
      return
    }
    pending.push(args)
    if (resolving) return
    resolving = true
    let done = false
    let sessionNumber
    let sessionId
    let clientId
    let received = 0
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      const key =
        typeof clientId === 'string' &&
        (typeof sessionId === 'string' || typeof sessionId === 'number')
          ? \`\${clientId}:\${sessionId}\`
          : ''
      let quality = classify({ ...entry, sessionNumber }, config)
      if (!key) quality = 'unknown'
      // Use GA's session identity, never a separate "new visitor" cookie.
      try {
        const saved = JSON.parse(
          localStorage.getItem('tanstack:traffic-quality') || 'null',
        )
        if (
          key &&
          saved?.key === key &&
          ['automated', 'suspect', 'unflagged'].includes(saved.quality)
        )
          quality = saved.quality
        else if (key && quality !== 'unknown')
          localStorage.setItem(
            'tanstack:traffic-quality',
            JSON.stringify({ key, quality }),
          )
      } catch {
        /* Storage may be disabled. Classification still works for this document. */
      }
      const events = pending
      pending = []
      resolving = false
      for (const event of events) {
        send(event[0], event[1], { ...event[2], traffic_quality: quality, traffic_quality_rule: 'v1' })
      }
      if (
        key !== diagnosedSession &&
        (quality === 'automated' || quality === 'suspect')
      ) {
        diagnosedSession = key
        // No client ID, session ID, URL, or IP is sent in this diagnostic body.
        if (
          navigator.doNotTrack !== '1' &&
          !(
            'globalPrivacyControl' in navigator &&
            navigator.globalPrivacyControl
          )
        ) {
          navigator.sendBeacon(
            '/_a/traffic-quality',
            new Blob(
              [
                JSON.stringify({
                  quality,
                  webdriver: navigator.webdriver === true,
                }),
              ],
              { type: 'application/json' },
            ),
          )
        }
      }
    }
    const timer = setTimeout(finish, 5000)
    const complete = () => {
      if (++received === 3) finish()
    }
    send('get', id, 'session_number', (value) => {
      sessionNumber = value
      complete()
    })
    send('get', id, 'session_id', (value) => {
      sessionId = value
      complete()
    })
    send('get', id, 'client_id', (value) => {
      clientId = value
      complete()
    })
  }
}

`

export const TRAFFIC_QUALITY_BOOTSTRAP = `(${INSTALL_TRAFFIC_QUALITY})('G-JMT1Z50SPS',${classifyTraffic.toString()},${JSON.stringify(TRAFFIC_QUALITY_CONFIG)});`
