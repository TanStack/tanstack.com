import { Button } from '~/ui/Button'
import { useState } from 'react'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import {
  getChatAccess,
  issueChatInvite,
  acceptChatInvite,
} from '~/chat/access.functions'

export const Route = createFileRoute('/chat-access')({
  validateSearch: (search: Record<string, unknown>) => ({
    invite: typeof search.invite === 'string' ? search.invite : undefined,
  }),
  loader: () => getChatAccess(),
  component: ChatAccess,
})
function ChatAccess() {
  const access = Route.useLoaderData()
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
  return (
    <main className="mx-auto max-w-lg px-6 py-16 space-y-6">
      <h1 className="text-3xl font-semibold">TanChat</h1>
      {!access ? (
        <>
          <p>Sign in to use your invite.</p>
          <Link
            to="/login"
            search={{
              returnTo: `/chat-access${invite ? `?invite=${encodeURIComponent(invite)}` : ''}`,
            }}
          >
            Sign in
          </Link>
        </>
      ) : access.unlocked ? (
        <>
          <Button as={Link} to="/chat">
            Open TanChat
          </Button>
          <h2 className="text-xl">Invite someone</h2>
          <p>
            {access.unlimited
              ? 'You have unlimited invites.'
              : `${access.remaining} invites left.`}{' '}
            Each invite can be used once and expires after seven days.
          </p>
          <Button
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
            <div className="space-y-3">
              <input
                aria-label="Invite link"
                readOnly
                value={link}
                className="w-full rounded-lg border p-3"
              />
              <Button
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
        </>
      ) : (
        <>
          <p>
            TanChat is an early alpha. Ask someone with access for an invite.
          </p>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              void action(async () => {
                await acceptChatInvite({ data: { token: code.trim() } })
                await router.navigate({ to: '/chat' })
              })
            }}
          >
            <label className="block" htmlFor="chat-invite">
              Invite code
            </label>
            <input
              id="chat-invite"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="w-full rounded-lg border p-3"
            />
            <Button disabled={busy || !code.trim()}>Use invite</Button>
          </form>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
