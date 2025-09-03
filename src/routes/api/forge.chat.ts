import fs from 'node:fs'
import { ConvexHttpClient } from 'convex/browser'
import { anthropic } from '@ai-sdk/anthropic'
import {
  convertToModelMessages,
  createIdGenerator,
  stepCountIs,
  streamText,
} from 'ai'

import { api } from 'convex/_generated/api'

import type { UIMessage } from 'ai'

import { getTools } from '~/forge/tools'
import { Id } from 'convex/_generated/dataModel'

const convex = new ConvexHttpClient(process.env.CONVEX_URL!)

const recipes = fs.readFileSync(
  new URL('../../../public/tanstack-start-react-recipes.md', import.meta.url)
    .pathname,
  'utf8'
)

const SYSTEM_PROMPT = `You are a coding assistant. Your job is to enhance an existing TanStack Start project based on the user's requests.

Here are patterns for TanStack Start React:

${recipes}
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
  POST: async ({ request }) => {
    try {
      const { messages, projectId } = await request.json()

      if (!projectId || typeof projectId !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Project ID is required' }),
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

      const { listDirectory, readFile, writeFile, deleteFile, fileTreeText } =
        await getTools(convex, projectId)

      const result = await streamText({
        model: anthropic('claude-3-5-sonnet-latest'),
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
