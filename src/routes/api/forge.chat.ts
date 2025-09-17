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
- **addDependency**: Add one or more dependencies to package.json

### When to use addDependency

Use the addDependency tool when:
- The user asks to install or add a package/dependency
- You need to add a library that's required for the functionality being implemented
- The user mentions missing dependencies or packages
- You're implementing features that require external libraries

The addDependency tool will automatically:
- Fetch the latest version from NPM registry
- Add the dependency to package.json (either as a regular dependency or devDependency)
- Update the project files

Example usage:
- User: "Add React Router to the project"
- You: Use addDependency with modules: ["react-router-dom"] and devDependency: false

- User: "Install TypeScript types for React"
- You: Use addDependency with modules: ["@types/react", "@types/react-dom"] and devDependency: true
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

      const { listDirectory, readFile, writeFile, deleteFile, addDependency, fileTreeText } =
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
