import { ConvexHttpClient } from 'convex/browser'
import { anthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

import { api } from 'convex/_generated/api'

import { initialize } from '~/forge/engine-handling/initialize'
import { generateInitialPayload } from '~/forge/engine-handling/generate-initial-payload'

const convex = new ConvexHttpClient(process.env.CONVEX_URL!)

export const ServerRoute = createServerFileRoute().methods({
  POST: async (ctx) => {
    const { description } = await ctx.request.json()

    // This is a total hack, but it works
    const cookies = ctx.request.headers.get('cookie')
    let sessionToken: string | null = null
    if (cookies) {
      const match = cookies.match(/better-auth.convex_jwt=([^;]+)/)
      if (match) {
        sessionToken = match[1]
      }
    }
    // This part is not a hack, we do need to set the auth token for the convex client
    convex.setAuth(sessionToken!)

    initialize()

    const output = await generateInitialPayload()

    const nameResult = await generateText({
      model: anthropic('claude-3-5-sonnet-latest'),
      prompt: `Summarize the following project description into a short, clear project name (max 5 words):\n\n"${description}"`,
      temperature: 0.5,
    })
    const name =
      nameResult.text.trim().replace(/^["']|["']$/g, '') || description

    const projectId = await convex.mutation(api.forge.createProject, {
      name,
      description,
      files: Object.entries(
        (output.output as { files: Record<string, string> }).files
      ).map(([path, content]) => ({
        path,
        content,
      })),
    })

    return Response.json({ projectId: projectId.toString() })
  },
})
