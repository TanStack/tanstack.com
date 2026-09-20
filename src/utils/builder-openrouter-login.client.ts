import {
  buildOpenRouterAuthUrl,
  createS256CodeChallenge,
  exchangeOpenRouterCode,
  generateCodeVerifier,
} from '@tanstack/ai-openrouter/pkce'

export function startBuilderOpenRouterLogin(signal: AbortSignal) {
  signal.throwIfAborted()
  if (!window.isSecureContext || typeof BroadcastChannel === 'undefined') {
    throw new Error(
      'OpenRouter sign-in requires HTTPS and a browser with tab messaging support.',
    )
  }

  const state = crypto.randomUUID()
  const channel = new BroadcastChannel(`builder-openrouter:${state}`)
  // Open synchronously from the click, before hashing, to avoid popup blocking.
  const popup = window.open(
    'about:blank',
    '_blank',
    'popup,width=520,height=720',
  )
  if (!popup) {
    channel.close()
    throw new Error('Allow popups for this site to connect OpenRouter.')
  }
  popup.opener = null
  const verifier = generateCodeVerifier()
  const callback = new URL(
    '/api/builder/openrouter/callback',
    window.location.origin,
  )
  callback.searchParams.set('state', state)

  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => {
        finish(new Error('OpenRouter sign-in timed out. Please try again.'))
      },
      10 * 60 * 1000,
    )
    let settled = false
    let exchanging = false

    function finish(error?: unknown, key?: string) {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      channel.close()
      signal.removeEventListener('abort', abort)
      popup?.close()
      if (error) reject(error)
      else if (key) resolve(key)
    }

    function abort() {
      finish(new DOMException('OpenRouter sign-in cancelled', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })

    // Builder's COOP headers sever window.opener across origins. A private
    // same-origin channel keeps the project tab and PKCE verifier in memory.
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data
      if (settled || exchanging || !isOpenRouterCallback(data, state)) return
      exchanging = true
      if (!data.code) {
        finish(new Error('OpenRouter authorization was not completed.'))
        return
      }
      void exchangeOpenRouterCode({
        code: data.code,
        codeVerifier: verifier,
        codeChallengeMethod: 'S256',
        fetchImpl: (input, init) =>
          fetch(input, {
            ...init,
            signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
          }),
      }).then(
        (key) => finish(undefined, key),
        () => {
          finish(
            new Error(
              'Could not finish connecting OpenRouter. Please try again.',
            ),
          )
        },
      )
    }

    void createS256CodeChallenge(verifier)
      .then((codeChallenge) => {
        if (settled) return
        popup.location.replace(
          buildOpenRouterAuthUrl({
            callbackUrl: callback.href,
            codeChallenge,
            codeChallengeMethod: 'S256',
          }),
        )
      })
      .catch((error: unknown) => finish(error))
  })
}

export function isOpenRouterCallback(
  value: unknown,
  state: string,
): value is { state: string; code: string | null } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'state' in value &&
    value.state === state &&
    'code' in value &&
    (value.code === null ||
      (typeof value.code === 'string' &&
        value.code.length > 0 &&
        value.code.length <= 4_096))
  )
}
