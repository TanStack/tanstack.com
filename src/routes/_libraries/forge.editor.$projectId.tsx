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
  component: App,
  loader: async ({ params }) => {
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

  const onSetCheckpoint = () => {
    setLastCheckpoint(convertToRecord(projectFiles ?? []))
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
  const projectId = Route.useParams().projectId as Id<'forge_projects'>
  const { chatMessages, projectFiles, projectDescription } =
    Route.useLoaderData()

  return (
    <AIApp
      projectId={projectId}
      initialFiles={projectFiles}
      chatMessages={chatMessages.map(deserializeMessage)}
      projectDescription={projectDescription}
    />
  )
}
