import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/builder/openrouter/callback')({
  server: { handlers: { GET: () => openRouterCallbackResponse() } },
})

export function openRouterCallbackResponse() {
  const nonce = crypto.randomUUID()
  // Do not load the app, analytics, or third-party assets while the
  // authorization code is in the URL.
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect OpenRouter | TanStack Builder</title></head>
<body><p id="status">Return to Builder to finish connecting OpenRouter.</p>
<script nonce="${nonce}">
const params = new URLSearchParams(location.search);
history.replaceState(null, '', location.pathname);
const state = params.get('state');
const code = params.get('code');
if (state && /^[a-f0-9-]{36}$/.test(state) && typeof BroadcastChannel !== 'undefined') {
  const channel = new BroadcastChannel('builder-openrouter:' + state);
  channel.postMessage({ state, code });
  channel.close();
} else {
  document.getElementById('status').textContent = 'This sign-in could not be completed. Return to Builder and try again.';
}
</script></body></html>`, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  })
}
