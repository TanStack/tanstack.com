import { createFileRoute } from '@tanstack/react-router'
import { ConvexHttpClient } from 'convex/browser'
import { api } from 'convex/_generated/api'

const convex = new ConvexHttpClient(process.env.CONVEX_URL!)

export const Route = createFileRoute('/api/forge/new-project')({
  server: {
    handlers: {
      POST: async (ctx) => {
        // Import server-only modules inside the handler to prevent client bundling
        const { anthropic } = await import('@ai-sdk/anthropic')
        const { openai } = await import('@ai-sdk/openai')
        const { generateText } = await import('ai')
        const { getFrameworkById, getAllAddOns } = await import(
          '@tanstack/cta-engine'
        )
        const { initialize } = await import(
          '~/forge/engine-handling/initialize'
        )
        const { generateInitialPayload } = await import(
          '~/forge/engine-handling/generate-initial-payload'
        )
        const { setServerEnvironment } = await import(
          '~/forge/engine-handling/server-environment'
        )

        try {
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

          // Fetch LLM keys from Convex for the authenticated user
          const llmKeys = await convex.query(api.llmKeys.listMyLLMKeys)

          if (!llmKeys || !Array.isArray(llmKeys)) {
            return new Response(
              JSON.stringify({ error: 'LLM keys are required' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
          }

          // Find active keys from user's LLM keys - prefer Anthropic, fallback to OpenAI
          const anthropicKey = llmKeys.find(
            (key: any) => key.provider === 'anthropic' && key.isActive
          )
          const openaiKey = llmKeys.find(
            (key: any) => key.provider === 'openai' && key.isActive
          )

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
              JSON.stringify({
                error:
                  'No active LLM API keys found. Please add API keys in your account settings.',
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
          }

          await initialize()

          // Get available add-ons for the framework
          const framework = await getFrameworkById('react-cra')
          const availableAddOns = getAllAddOns(framework!, 'file-router')

          // Prepare add-on information for the AI
          const addOnDescriptions = availableAddOns
            .filter((addon) => addon.id !== 'start') // Exclude 'start' as it's always included
            .map(
              (addon) => `- ${addon.id}: ${addon.name} - ${addon.description}`
            )
            .join('\n')

          // Have AI select appropriate add-ons based on the project description
          const addOnSelectionPrompt = `Based on the following project description, select the most relevant TanStack add-ons that would be helpful for this project.
    
    Project Description: "${description}"
    
    Available Add-ons:
    ${addOnDescriptions}
    
    Respond with a JSON array of add-on IDs that would be most beneficial for this project. Only include add-ons that are clearly relevant to the described functionality.
    For example: ["tanstack-query", "tanstack-form"]
    If no add-ons are clearly relevant, respond with an empty array: []
    
    Consider:
    - If the project involves data fetching, API calls, or server state: include "tanstack-query"
    - If the project involves forms, user input, or validation: include "tanstack-form"
    - If the project involves complex tables or data grids: include "tanstack-table"
    - If the project involves virtualized lists or infinite scrolling: include "tanstack-virtual"
    
    Response (JSON array only):`

          const [nameResult, addOnResult] = await Promise.all([
            generateText({
              model: apiProvider,
              prompt: `Summarize the following project description into a short, clear project name (max 5 words):\n\n"${description}"`,
              temperature: 0.5,
            }),
            generateText({
              model: apiProvider,
              prompt: addOnSelectionPrompt,
              temperature: 0.3, // Lower temperature for more deterministic selection
            }),
          ])

          const name =
            nameResult.text.trim().replace(/^["']|["']$/g, '') || description

          // Parse the selected add-ons
          let selectedAddOns: string[] = ['start'] // Always include 'start'
          try {
            const parsedAddOns = JSON.parse(addOnResult.text.trim())
            if (Array.isArray(parsedAddOns)) {
              // Validate that selected add-ons exist in available add-ons
              const validAddOns = parsedAddOns.filter((id) =>
                availableAddOns.some((addon) => addon.id === id)
              )
              selectedAddOns = ['start', ...validAddOns]
            }
          } catch (error) {
            console.error('Failed to parse AI-selected add-ons:', error)
            // Fall back to just 'start' if parsing fails
          }

          console.log('AI selected add-ons:', selectedAddOns)

          // Set the selected add-ons as forced add-ons
          setServerEnvironment({
            forcedAddOns: selectedAddOns,
          })

          const output = await generateInitialPayload()

          const projectId = await convex.mutation(api.forge.createProject, {
            name,
            description,
            selectedAddOns: selectedAddOns.filter((id) => id !== 'start'), // Store add-ons except 'start'
            files: Object.entries(
              (output.output as { files: Record<string, string> }).files
            ).map(([path, content]) => ({
              path,
              content,
            })),
          })

          return Response.json({
            projectId: projectId.toString(),
            selectedAddOns: selectedAddOns.filter((id) => id !== 'start'), // Return add-ons except 'start' for UI feedback
          })
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
    },
  },
})
