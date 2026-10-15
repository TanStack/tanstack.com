import { getChatAccess } from '~/chat/access.functions'
import { createServerFn } from '@tanstack/react-start'
import { appearanceScript } from '~/chat/core/appearance-bootstrap'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { ChatShell } from '~/chat/components/ChatShell'
import chatStyles from '~/chat/styles.css?url'
import { webContainerHeaders } from '~/utils/stackblitz-embed'

const initialAppearance = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { readInitialAppearance } =
      await import('~/chat/server/appearance-html')
    return readInitialAppearance()
  },
)

export const Route = createFileRoute('/chat')({
  staticData: { showNavbar: false },
  beforeLoad: async ({ cause }) => {
    if (cause === 'stay') return
    const access = await getChatAccess()
    if (!access?.unlocked)
      throw redirect({ to: '/chat-access', search: { invite: undefined } })
  },
  loader: () => (typeof window === 'undefined' ? initialAppearance() : null),
  staleTime: Infinity,
  shouldReload: false,
  headers: () => ({
    ...webContainerHeaders,
    'Cache-Control': 'private, no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
  }),
  head: ({ loaderData }) => ({
    links: [{ rel: 'stylesheet', href: chatStyles }],
    scripts: [
      {
        children: `${loaderData ? `document.documentElement.setAttribute('data-gum-ssr-appearance',${JSON.stringify(loaderData).replace(/</g, '\\u003c')});` : ''}${appearanceScript}`,
      },
    ],
  }),
  component: ChatShell,
})
