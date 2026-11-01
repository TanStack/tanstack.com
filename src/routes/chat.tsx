import { createServerFn } from '@tanstack/react-start'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { ChatShellRoute } from '~/chat/components/ChatShellRoute'
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
    const { getChatAccess } = await import('~/chat/access.functions')
    const access = await getChatAccess()
    if (!access?.unlocked)
      throw redirect({ to: '/chat-access', search: { invite: undefined } })
  },
  loader: async () => {
    const [{ appearanceScript }, { default: chatStyles }, appearance] =
      await Promise.all([
        import('~/chat/core/appearance-bootstrap'),
        import('~/chat/styles.css?url'),
        typeof window === 'undefined' ? initialAppearance() : null,
      ])
    return { appearanceScript, chatStyles, appearance }
  },
  staleTime: Infinity,
  shouldReload: false,
  headers: () => ({
    ...webContainerHeaders,
    'Cache-Control': 'private, no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
  }),
  head: ({ loaderData }) => ({
    links: [{ rel: 'stylesheet', href: loaderData?.chatStyles }],
    scripts: [
      {
        children: `${loaderData?.appearance ? `document.documentElement.setAttribute('data-gum-ssr-appearance',${JSON.stringify(loaderData.appearance).replace(/</g, '\\u003c')});` : ''}${loaderData?.appearanceScript ?? ''}`,
      },
    ],
  }),
  component: ChatShellRoute,
})
