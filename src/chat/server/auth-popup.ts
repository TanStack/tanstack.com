/** Completion is a signal to refetch authenticated state, never a credential. */
export function authPopupComplete(
  headers: Headers,
  channelId?: string,
): Response {
  const nonce = crypto.randomUUID()
  headers.delete('Location')
  headers.set('Content-Type', 'text/html; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set(
    'Content-Security-Policy',
    `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`,
  )
  const channelScript = channelId
    ? `const channel=new BroadcastChannel(${JSON.stringify('tanstack.auth.' + channelId)});channel.postMessage({type:'kody-banks:auth-complete'});channel.close();`
    : ''
  return new Response(
    `<!doctype html><html><head><title>Connected to TanChat</title></head><body><p>Connected. You can close this window.</p><script nonce="${nonce}">${channelScript}window.opener?.postMessage({type:'kody-banks:auth-complete'}, location.origin); window.close();</script></body></html>`,
    { headers },
  )
}
