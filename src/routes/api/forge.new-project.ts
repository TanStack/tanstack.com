import { ConvexHttpClient } from 'convex/browser'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

import { api } from 'convex/_generated/api'

import { initialize } from '~/forge/engine-handling/initialize'
import { generateInitialPayload } from '~/forge/engine-handling/generate-initial-payload'

const convex = new ConvexHttpClient(process.env.CONVEX_URL!)

export const ServerRoute = createServerFileRoute().methods({
  POST: async (ctx) => {
    try {
      const { description, llmKeys } = await ctx.request.json()

      if (!llmKeys || !Array.isArray(llmKeys)) {
        return new Response(
          JSON.stringify({ error: 'LLM keys are required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

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

      // Find active keys from provided LLM keys - prefer Anthropic, fallback to OpenAI
      const anthropicKey = llmKeys.find((key: any) => key.provider === 'anthropic' && key.isActive)
      const openaiKey = llmKeys.find((key: any) => key.provider === 'openai' && key.isActive)
      
      let apiProvider
      
      if (anthropicKey) {
        // Set the API key as environment variable for this request
        process.env.ANTHROPIC_API_KEY = anthropicKey.apiKey
        apiProvider = anthropic('claude-3-5-sonnet-latest')
      } else if (openaiKey) {
        // Set the API key as environment variable for this request
        process.env.OPENAI_API_KEY = openaiKey.apiKey
        apiProvider = openai('gpt-4-mini')
      } else {
        return new Response(
          JSON.stringify({ error: 'No active LLM API keys found. Please add API keys in your account settings.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      initialize()

      const output = await generateInitialPayload()

      const nameResult = await generateText({
        model: apiProvider,
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
    } catch (error) {
      console.error('New project API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to create project' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  },
})
