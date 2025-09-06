import { useState, useEffect } from 'react'
import { useQuery } from 'convex/react'

import { Link } from '@tanstack/react-router'

import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'

import type { UIMessage } from 'ai'
import { getLLMKeys, hasActiveKeys } from '~/utils/llmKeys'

import {
  getChatMessages,
  getProjectDescription,
  getProjectFiles,
} from '~/forge/engine-handling/server-functions'
import { TabbedViewer } from '~/forge/ui/tabbed-viewer'
import Chat from '~/forge/ui/chat'
import { ForgeExportDropdown } from '~/forge/ui/export-dropdown'
import WebContainerProvider from '~/forge/ui/web-container-provider'
import { Sparkles } from 'lucide-react'

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
  headers(ctx) {
    return {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
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

function Header({
  projectFiles,
  projectName,
}: {
  projectFiles?: Array<{ path: string; content: string }>
  projectName?: string
}) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
      <div className="flex items-center gap-6">
        {/* TanStack Forge Branding */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">TanStack Forge</h1>
            <p className="text-xs text-slate-400">AI Development Studio</p>
          </div>
        </div>
        <Link
          to="/forge"
          className="text-sm text-slate-400 hover:text-white transition-colors"
        >
          ← Back to projects
        </Link>
      </div>

      <div className="flex items-center gap-2">
        {projectFiles && projectFiles.length > 0 && (
          <ForgeExportDropdown
            projectFiles={projectFiles}
            projectName={projectName}
          />
        )}
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
  const projectData = useQuery(api.forge.getProject, {
    projectId,
  })
  const [llmKeys, setLlmKeys] = useState<any[]>([])
  const [keysLoaded, setKeysLoaded] = useState(false)

  // Load LLM keys from localStorage
  useEffect(() => {
    setLlmKeys(getLLMKeys())
    setKeysLoaded(true)
  }, [])

  const onSetCheckpoint = () => {
    setLastCheckpoint(convertToRecord(projectFiles ?? []))
  }

  // Check if user has any active LLM keys
  const hasActiveKeysCheck = keysLoaded && hasActiveKeys()

  // Show loading state while checking keys
  if (!keysLoaded) {
    return (
      <div className="h-screen bg-slate-950 w-full">
        <Header />
        <div className="h-[calc(100vh-73px)] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="text-slate-400">Loading project...</div>
          </div>
        </div>
      </div>
    )
  }

  // Show key requirement message if no active keys
  if (!hasActiveKeysCheck) {
    return (
      <div className="h-screen bg-slate-950 w-full">
        <Header
          projectFiles={projectFiles ?? []}
          projectName={projectData?.name}
        />
        <div className="h-[calc(100vh-73px)] flex items-center justify-center p-8">
          <div className="w-full max-w-2xl space-y-8 text-center">
            <div className="p-6 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl">
              <div className="p-4 bg-amber-500/10 rounded-xl mb-6 inline-block">
                <div className="text-4xl">🔑</div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">
                AI Models Setup Required
              </h1>
              <p className="text-slate-400 text-lg mb-8">
                To use the Forge, you need to configure your API keys. We
                support OpenAI and Anthropic models.
              </p>
              <Link
                to="/account"
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition-all duration-200 text-lg shadow-2xl shadow-blue-500/25"
              >
                Configure API Keys
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <WebContainerProvider>
      <div className="h-screen bg-slate-950 w-full">
        <Header
          projectFiles={projectFiles ?? []}
          projectName={projectData?.name}
        />
        <div className="h-[calc(100vh-73px)] @container">
          <div className="flex flex-row h-full">
            <div className="w-2/5 h-full">
              <Chat
                projectId={projectId}
                initialMessages={chatMessages}
                onSetCheckpoint={onSetCheckpoint}
                projectDescription={projectDescription}
                llmKeys={llmKeys}
              />
            </div>
            <div className="w-3/5 h-full overflow-hidden border-l border-slate-800">
              <TabbedViewer
                originalTree={lastCheckpoint}
                projectFiles={convertToRecord(projectFiles ?? [])}
                projectFilesArray={projectFiles ?? []}
                projectName={projectData?.name}
              />
            </div>
          </div>
        </div>
      </div>
    </WebContainerProvider>
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
