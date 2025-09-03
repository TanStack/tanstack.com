import { useState } from 'react'
import { useQuery } from 'convex/react'

import { Link } from '@tanstack/react-router'

import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

import type { UIMessage } from 'ai'

import {
  getChatMessages,
  getProjectDescription,
  getProjectFiles,
} from '~/forge/engine-handling/server-functions'
import FileNavigator from '~/forge/ui/file-navigator'
import Chat from '~/forge/ui/chat'
import Sidebar from '~/forge/ui/sidebar'

function deserializeMessage(message: {
  content: string
  role: string
  messageId: string
}) {
  const { content, messageId, ...rest } = message
  return {
    id: messageId,
    ...rest,
    ...JSON.parse(content),
  }
}

export const Route = createFileRoute({
  component: AuthenticationWrapper,
  loader: async ({ params }: { params: { projectId: string } }) => {
    const chatMessages = await getChatMessages({
      data: { projectId: params.projectId },
    })
    const projectFiles = await getProjectFiles({
      data: { projectId: params.projectId },
    })
    const projectDescription = await getProjectDescription({
      data: { projectId: params.projectId },
    })
    return {
      chatMessages,
      projectFiles,
      projectDescription,
    }
  },
})

function addDotToKey(key: string) {
  return key.replace(/^\//, './')
}

function addDotsToKeys(obj: Array<{ path: string; content: string }>) {
  return obj.map(({ path, content }) => [addDotToKey(path), content])
}

function convertToRecord(files: Array<{ path: string; content: string }>) {
  return Object.fromEntries(addDotsToKeys(files))
}

function Header() {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-background">
      <div className="flex items-center gap-4">
        <Link
          to="/forge"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to projects
        </Link>
      </div>
    </div>
  )
}

function AIApp({
  projectId,
  chatMessages,
  initialFiles,
  projectDescription,
}: {
  projectId: Id<'forge_projects'>
  chatMessages: Array<UIMessage>
  initialFiles: Array<{ path: string; content: string }>
  projectDescription: string
}) {
  const [lastCheckpoint, setLastCheckpoint] = useState(
    convertToRecord(initialFiles)
  )
  const projectFiles = useQuery(api.forge.getProjectFiles, {
    projectId,
  })
  const projects = useQuery(api.forge.getProjects)
  const llmKeys = useQuery(api.llmKeys.listMyLLMKeysForDisplay)

  const onSetCheckpoint = () => {
    setLastCheckpoint(convertToRecord(projectFiles ?? []))
  }

  // Check if user has any active LLM keys
  const hasActiveKeys = llmKeys?.some((key) => key.isActive) ?? false

  // Show loading state while checking keys
  if (llmKeys === undefined) {
    return (
      <div className="flex h-screen bg-background w-full">
        <Sidebar projects={projects} />
        <main className="flex-1 min-w-0">
          <Header />
          <div className="h-[calc(100vh-73px)] flex items-center justify-center">
            <div className="text-center">Loading...</div>
          </div>
        </main>
      </div>
    )
  }

  // Show key requirement message if no active keys
  if (!hasActiveKeys) {
    return (
      <div className="flex h-screen bg-background w-full">
        <Sidebar projects={projects} />
        <main className="flex-1 min-w-0">
          <Header />
          <div className="h-[calc(100vh-73px)] flex items-center justify-center p-8">
            <div className="w-full max-w-2xl space-y-4 text-center">
              <div className="text-6xl mb-4">🔑</div>
              <h1 className="text-2xl font-bold text-foreground">
                LLM API Keys Required
              </h1>
              <p className="text-muted-foreground">
                To use the Forge, you need to add your own LLM API keys. We
                support OpenAI and Anthropic.
              </p>
              <div className="flex justify-center">
                <Link
                  to="/account"
                  className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
                >
                  Add API Keys
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background w-full">
      <Sidebar projects={projects} />
      <main className="flex-1 min-w-0">
        <Header />
        <div className="h-[calc(100vh-73px)] @container">
          <div className="flex flex-row h-full">
            <div className="w-1/3">
              <Chat
                projectId={projectId}
                initialMessages={chatMessages}
                onSetCheckpoint={onSetCheckpoint}
                projectDescription={projectDescription}
                llmKeys={llmKeys}
              />
            </div>
            <div className="w-2/3 @8xl:w-3/4 pl-2 h-full overflow-y-auto">
              <FileNavigator
                originalTree={lastCheckpoint}
                projectFiles={convertToRecord(projectFiles ?? [])}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function App() {
  const { projectId } = Route.useParams()
  const { chatMessages, projectFiles, projectDescription } =
    Route.useLoaderData()

  return (
    <AIApp
      projectId={projectId as Id<'forge_projects'>}
      initialFiles={projectFiles}
      chatMessages={chatMessages.map(deserializeMessage)}
      projectDescription={projectDescription}
    />
  )
}

function AuthenticationWrapper() {
  const user = useQuery(api.auth.getCurrentUser)

  return <>{user ? <App /> : <div>Loading...</div>}</>
}
