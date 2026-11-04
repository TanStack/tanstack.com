import { Button } from '~/ui/Button'
import { useState } from 'react'
import {
  createFileRoute,
  createLink,
  Link,
  useRouter,
} from '@tanstack/react-router'
import { ArrowRightIcon } from '@phosphor-icons/react/ArrowRight'
import { CheckCircleIcon } from '@phosphor-icons/react/CheckCircle'
import { seo } from '~/utils/seo'
import {
  getChatAccess,
  getChatWaitlist,
  requestChatAccess,
  issueChatInvite,
  acceptChatInvite,
} from '~/chat/access.functions'

export const Route = createFileRoute('/chat-access')({
  validateSearch: (search: Record<string, unknown>) => ({
    invite: typeof search.invite === 'string' ? search.invite : undefined,
  }),
  loader: async () => {
    const access = await getChatAccess()
    const waitlisted =
      access && !access.unlocked ? await getChatWaitlist() : false
    return { access, waitlisted }
  },
  head: () => ({
    meta: seo({
      title: 'TanChat | TanStack',
      description:
        'Something new is coming. Join the TanChat waitlist or redeem your invite.',
    }),
  }),
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
  }),
  component: ChatAccess,
})

const ButtonLink = createLink(Button)

function ChatAccess() {
  const { access, waitlisted } = Route.useLoaderData()
  const { invite } = Route.useSearch()
  const router = useRouter()
  const [code, setCode] = useState(invite ?? '')
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const action = async (run: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await run()
      await router.invalidate()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const signInSearch = {
    returnTo: `/chat-access${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`,
  }
  const buttonClass =
    'bg-text-primary text-background-default border-transparent hover:bg-text-secondary dark:bg-text-primary dark:text-background-default dark:hover:bg-text-secondary'
  const inputClass =
    'w-full rounded-xl border border-border-default bg-background-default px-4 py-3 text-sm outline-none focus:border-border-focus focus:ring-2 focus:ring-border-focus/20'

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col justify-center px-6 py-16 sm:px-10 sm:py-24 lg:min-h-[calc(100dvh-var(--navbar-height))]">
      <section className="max-w-xl">
        <div className="mb-8 flex items-center gap-3">
          <img
            src="/images/brand/tanstack-emblem-charcoal.svg"
            alt=""
            className="h-12 w-12 dark:hidden"
          />
          <img
            src="/images/brand/tanstack-emblem-cream.svg"
            alt=""
            className="hidden h-12 w-12 dark:block"
          />
          <span className="font-ds-display text-3xl font-bold tracking-tight">
            TanChat
          </span>
          <span className="ml-1 rounded-full border border-border-default px-2.5 py-1 text-xs text-text-secondary">
            Early alpha
          </span>
        </div>
        <h1 className="font-ds-display text-5xl font-bold leading-[1.04] tracking-tight sm:text-6xl lg:text-6xl">
          Something new is coming.
        </h1>
        <div className="mt-9 space-y-5">
          {!access ? (
            <>
              <ButtonLink
                as="a"
                to="/login"
                search={signInSearch}
                size="lg"
                rounded="full"
                className={buttonClass}
              >
                {invite
                  ? 'Sign in to use your invite'
                  : 'Sign in to join the waitlist'}
                <ArrowRightIcon className="size-5" />
              </ButtonLink>
              <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
                {invite
                  ? 'Your invite will be ready after you sign in.'
                  : 'We’re opening access a little at a time. Already have an invite? Sign in to redeem it.'}
              </p>
            </>
          ) : access.unlocked ? (
            <>
              <Button
                as={Link}
                to="/chat"
                size="lg"
                rounded="full"
                className={buttonClass}
              >
                Open TanChat
                <ArrowRightIcon className="size-5" />
              </Button>
              <div className="border-t border-border-default pt-6">
                <h2 className="font-ds-display text-xl font-semibold">
                  Invite someone
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {access.unlimited
                    ? 'You have unlimited invites.'
                    : `${access.remaining} invites left.`}{' '}
                  Each invite works once and expires in seven days.
                </p>
                <Button
                  variant="secondary"
                  className="mt-4"
                  disabled={busy || access.remaining === 0}
                  onClick={() =>
                    void action(async () => {
                      const result = await issueChatInvite()
                      setLink(
                        `${window.location.origin}/chat-access?invite=${encodeURIComponent(result.token)}`,
                      )
                    })
                  }
                >
                  Create invite link
                </Button>
                {link && (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      aria-label="Invite link"
                      readOnly
                      value={link}
                      className={inputClass}
                    />
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void action(async () => {
                          await navigator.clipboard.writeText(link)
                        })
                      }
                    >
                      Copy link
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {waitlisted ? (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-2xl bg-background-subtle p-5"
                >
                  <CheckCircleIcon className="mt-0.5 size-6 shrink-0" />
                  <div>
                    <p className="font-semibold">You’re on the waitlist.</p>
                    <p className="mt-1 text-sm text-text-secondary">
                      Your request is saved. You can still use an invite below.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Button
                    size="lg"
                    rounded="full"
                    className={buttonClass}
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        await requestChatAccess()
                      })
                    }
                  >
                    {busy ? 'Joining…' : 'Join the waitlist'}
                    <ArrowRightIcon className="size-5" />
                  </Button>
                  <p className="text-sm text-text-secondary">
                    We’re opening access a little at a time.
                  </p>
                </>
              )}
              <form
                className="space-y-3 border-t border-border-default pt-5"
                onSubmit={(event) => {
                  event.preventDefault()
                  void action(async () => {
                    await acceptChatInvite({ data: { token: code.trim() } })
                    await router.navigate({ to: '/chat' })
                  })
                }}
              >
                <label
                  className="block text-sm font-medium"
                  htmlFor="chat-invite"
                >
                  Have an invite?
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="chat-invite"
                    autoComplete="off"
                    placeholder="Paste your invite code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    className={inputClass}
                  />
                  <Button variant="secondary" disabled={busy || !code.trim()}>
                    Use invite
                  </Button>
                </div>
              </form>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-text-error">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
