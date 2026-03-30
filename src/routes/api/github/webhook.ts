import { createFileRoute } from '@tanstack/react-router'
import { Webhooks } from '@octokit/webhooks'
import { Octokit } from '@octokit/rest'
import { env } from '~/utils/env'
import { changesetPreview } from "~/github/changesetPreview"

const webhooks = new Webhooks({
  secret: env.GITHUB_WEBHOOK_SECRET,
})

function getOctokit() {
  return new Octokit({
    auth: env.GITHUB_AUTH_TOKEN
  })
}

// Register event handlers
webhooks.on(['pull_request.opened', 'pull_request.synchronize'], async ({ payload }) => {
  console.log('PR opened:', payload.pull_request.title)

  const octokit = getOctokit()

  await changesetPreview({
    owner: payload.pull_request.head.repo.owner!.login,
    repo: payload.pull_request.head.repo.name,
    ref: payload.pull_request.head.ref,
    pull_number: payload.number,
    octokit
  })
})

webhooks.onError((error) => {
  console.error('Webhook error:', error)
})

export const Route = createFileRoute('/api/github/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get('x-hub-signature-256') ?? ''
        const body = await request.text()

        const isValid = await webhooks.verify(body, signature)
        if (!isValid) {
          return new Response('Invalid signature', { status: 401 })
        }

        await webhooks.receive({
          id: request.headers.get('x-github-delivery') ?? '',
          name: request.headers.get('x-github-event') as any,
          payload: JSON.parse(body),
        })

        return new Response('OK', { status: 200 })
      },
    },
  },
})
