import { createFileRoute } from '@tanstack/react-router'
import { Webhooks } from '@octokit/webhooks'
import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET ?? 'test',
})

function getOctokit(installationId: number) {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_PRIVATE_KEY!,
      installationId,
    },
  })
}

// Register event handlers
webhooks.on('pull_request.opened', async ({ payload }) => {
  console.log('PR opened:', payload.pull_request.title)

  const octokit = getOctokit(payload.installation!.id)

  await octokit.issues.createComment({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.pull_request.number,
    body: `Thanks for opening this PR, @${payload.pull_request.user.login}! 👋`,
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
