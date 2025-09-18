import { ConvexHttpClient } from 'convex/browser'
import { anthropic } from '@ai-sdk/anthropic'
import { openai } from '@ai-sdk/openai'
import {
  convertToModelMessages,
  createIdGenerator,
  stepCountIs,
  streamText,
} from 'ai'

import { api } from 'convex/_generated/api'

import type { UIMessage } from 'ai'

import { getTools } from '~/forge/tools'
import recipes from '~/forge/data/tanstack-start-react-recipes'

import { Id } from 'convex/_generated/dataModel'

const convex = new ConvexHttpClient(process.env.CONVEX_URL!)

const SYSTEM_PROMPT = `You are a coding assistant. Your job is to enhance an existing TanStack Start project based on the user's requests.

Here are patterns for TanStack Start React:

${recipes}

## Available Tools

You have access to the following tools to help you work with the project:

- **listDirectory**: Read the contents of a directory
- **readFile**: Read the contents of a file
- **writeFile**: Write content to a file
- **deleteFile**: Delete a file
- **listAddOns**: List available TanStack add-ons for the project
- **addAddOn**: Add TanStack add-ons with proper integration
- **addDependency**: Add one or more dependencies to package.json

### IMPORTANT: Prefer TanStack Add-ons Over Manual Installation

**When the user requests functionality that involves TanStack libraries, ALWAYS check for and use available add-ons first:**

1. **Check for Add-ons First**: Use \`listAddOns\` to see available TanStack add-ons
2. **Use Add-ons When Available**: If a TanStack library has an add-on (e.g., tanstack-query, tanstack-form, tanstack-table, tanstack-virtual), use \`addAddOn\` instead of manual installation
3. **Benefits of Add-ons**: Add-ons provide:
   - Proper integration with TanStack Start
   - Automatic configuration
   - Type safety setup
   - Best practices implementation
   - Required dependencies and peer dependencies

### When to use addAddOn vs addDependency

**Use addAddOn for TanStack libraries:**
- User: "Add data fetching to the project" → Use \`addAddOn\` with ["tanstack-query"]
- User: "I need form handling" → Use \`addAddOn\` with ["tanstack-form"]
- User: "Add a data table" → Use \`addAddOn\` with ["tanstack-table"]
- User: "Implement virtual scrolling" → Use \`addAddOn\` with ["tanstack-virtual"]

**Use addDependency for non-TanStack libraries:**
- User: "Add React Router to the project" → Use \`addDependency\` with ["react-router-dom"]
- User: "Install lodash" → Use \`addDependency\` with ["lodash"]
- User: "Add TypeScript types for React" → Use \`addDependency\` with ["@types/react", "@types/react-dom"] as devDependencies

### Add-on Workflow

1. When functionality requires TanStack libraries:
   - First check available add-ons: \`listAddOns { includeInstalled: false }\`
   - Preview changes: \`addAddOn { addOnIds: ["addon-id"], mode: "preview" }\`
   - Apply if no conflicts: \`addAddOn { addOnIds: ["addon-id"], mode: "apply" }\`

2. The addAddOn tool will:
   - Properly integrate the library with your TanStack Start app
   - Set up all necessary configuration
   - Handle dependencies automatically
   - Ensure compatibility with existing code

Remember: TanStack add-ons provide superior integration compared to manual installation. Always prefer them when available.
`

// Serializer function to convert UIMessage to DB format
function serializeMessage(message: UIMessage) {
  const { id, role, ...rest } = message

  // Filter out system messages as they're not supported in the DB schema
  if (role === 'system') {
    return null
  }

  return {
    messageId: id,
    role,
    content: JSON.stringify(rest),
  }
}

// Function to save complete chat messages
async function saveChat(projectId: Id<'forge_projects'>, messages: Array<UIMessage>) {
  try {
    await convex.mutation(api.forge.addChatMessages, {
      projectId,
      messages: messages.filter(Boolean).map(serializeMessage) as Array<{
        role: 'user' | 'assistant'
        messageId: string
        content: string
      }>,
    })
  } catch (error) {
    console.error('Error saving chat messages:', error)
  }
}

export const ServerRoute = createServerFileRoute().methods({
  POST: async ({ request }: { request: Request }) => {
    try {
      const { messages, projectId, model } = await request.json()

      if (!projectId || typeof projectId !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Project ID is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      if (!model || typeof model !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Model is required' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      // This is a total hack, but it works
      const cookies = request.headers.get('cookie')
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

      // Determine which provider to use based on the model
      const isAnthropicModel = model.startsWith('claude-')
      const isOpenAIModel = model.startsWith('gpt-')
      
      let apiProvider
      let apiKey
      
      if (isAnthropicModel) {
        const anthropicKey = llmKeys.find((key: any) => key.provider === 'anthropic' && key.isActive)
        if (!anthropicKey) {
          return new Response(
            JSON.stringify({ error: 'No active Anthropic API key found' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }
        apiKey = anthropicKey.apiKey
        // Set the API key as environment variable for this request
        process.env.ANTHROPIC_API_KEY = apiKey
        apiProvider = anthropic(model)
      } else if (isOpenAIModel) {
        const openaiKey = llmKeys.find((key: any) => key.provider === 'openai' && key.isActive)
        if (!openaiKey) {
          return new Response(
            JSON.stringify({ error: 'No active OpenAI API key found' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }
        apiKey = openaiKey.apiKey
        // Set the API key as environment variable for this request
        process.env.OPENAI_API_KEY = apiKey
        apiProvider = openai(model)
      } else {
        return new Response(
          JSON.stringify({ error: 'Unsupported model' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
      }

      const { listDirectory, readFile, writeFile, deleteFile, addDependency, listAddOns, addAddOn, fileTreeText } =
        await getTools(convex, projectId)

      const result = await streamText({
        model: apiProvider,
        messages: convertToModelMessages(messages),
        temperature: 0.7,
        stopWhen: stepCountIs(30),
        system: `${SYSTEM_PROMPT}

        This is the current file tree of the project:

        ${fileTreeText}
        `,
        tools: {
          listDirectory,
          readFile,
          writeFile,
          deleteFile,
          addDependency,
          listAddOns,
          addAddOn,
        },
      })

      // Return UI message stream response with onFinish callback for persistence
      return result.toUIMessageStreamResponse({
        originalMessages: messages,
        generateMessageId: createIdGenerator({
          prefix: 'msg',
          size: 16,
        }),
        onFinish: async ({ messages: completeMessages }) => {
          // Save the complete conversation including the new assistant response
          await saveChat(projectId as Id<'forge_projects'>, completeMessages)
        },
      })
    } catch (error) {
      console.error('Chat API error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to process chat request' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  },
})
