import { useQuery } from 'convex/react'
import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import {
  Code2,
  Zap,
  Brain,
  Rocket,
  Activity,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Play,
  Settings,
  Key,
} from 'lucide-react'

import { api } from 'convex/_generated/api'
import { hasActiveKeys } from '~/utils/llmKeysConvex'

import Sidebar from '~/forge/ui/sidebar'

export const Route = createFileRoute({
  ssr: false,
  component: AuthenticationWrapper,
  headers(ctx: any) {
    return {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    }
  },
})

function App() {
  const projects = useQuery(api.forge.getProjects)
  const llmKeys = useQuery(api.llmKeys.listMyLLMKeys)
  const [description, setDescription] = useState('')

  const router = useRouter()

  // Check if user has any active LLM keys
  const hasActiveKeysCheck = llmKeys !== undefined && hasActiveKeys(llmKeys)

  const handleGetStarted = async () => {
    const res = await fetch('/api/forge/new-project', {
      method: 'POST',
      body: JSON.stringify({ description }),
    })
    const { projectId, selectedAddOns } = await res.json()

    // Log selected add-ons for debugging
    if (selectedAddOns && selectedAddOns.length > 0) {
      console.log('AI selected these add-ons for your project:', selectedAddOns)
    }

    router.navigate({
      to: '/forge/editor/$projectId',
      params: { projectId },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      handleGetStarted()
    }
  }

  // Show loading state while checking keys
  if (llmKeys === undefined) {
    return (
      <div className="flex flex-col md:flex-row h-screen bg-slate-950 w-full">
        <Sidebar projects={projects} />
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="text-slate-400">Initializing Forge...</div>
          </div>
        </div>
      </div>
    )
  }

  // Show key requirement message if no active keys
  if (!hasActiveKeysCheck) {
    return (
      <div className="flex flex-col md:flex-row h-screen bg-slate-950 w-full">
        <Sidebar projects={projects} />
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-2xl space-y-8 text-center">
            <div className="p-6 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl">
              <div className="p-4 bg-amber-500/10 rounded-xl mb-6 inline-block">
                <Key className="w-12 h-12 text-amber-400" />
              </div>
              <h1 className="text-3xl font-bold text-white mb-4">
                AI Models Setup Required
              </h1>
              <p className="text-slate-400 text-lg mb-8">
                To unlock the power of AI-assisted development, you need to
                configure your API keys. We support OpenAI and Anthropic models.
              </p>
              <div className="space-y-4">
                <Link
                  to="/account"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition-all duration-200 text-lg shadow-2xl shadow-blue-500/25"
                >
                  <Settings className="w-5 h-5" />
                  Configure API Keys
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <div className="text-sm text-slate-500">
                  Your keys are stored securely and never shared
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 w-full">
      <Sidebar projects={projects} />

      <div className="flex-1 overflow-y-auto">
        {/* Hero Section */}
        <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 border-b border-slate-800">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>
          <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-24">
            <div className="text-center space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                AI-Powered Development
              </div>

              <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
                Build Apps with
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  {' '}
                  AI Magic
                </span>
              </h1>

              <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                Describe your vision and watch as our AI assistant transforms
                your ideas into fully functional applications
              </p>

              {/* Input Section */}
              <div className="max-w-3xl mx-auto space-y-6 mt-12">
                <div className="relative">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your project idea... (e.g., 'A task management app with drag-and-drop functionality')"
                    className="w-full h-32 p-6 bg-slate-900/50 backdrop-blur-sm border border-slate-700 rounded-2xl resize-none text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg transition-all duration-200"
                  />
                  <div className="absolute bottom-4 right-4 text-xs text-slate-500">
                    Shift + Enter to create
                  </div>
                </div>

                <button
                  onClick={handleGetStarted}
                  disabled={!description.trim()}
                  className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-lg shadow-2xl shadow-blue-500/25"
                >
                  <Play className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  Start Building
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Code2 className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {projects?.length || 0}
                  </h3>
                  <p className="text-slate-400 text-sm">Active Projects</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <Zap className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    {hasActiveKeysCheck ? '✓' : '0'}
                  </h3>
                  <p className="text-slate-400 text-sm">AI Models Ready</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-purple-500/10 rounded-xl">
                  <Brain className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">∞</h3>
                  <p className="text-slate-400 text-sm">Ideas Possible</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-orange-500/10 rounded-xl">
                  <Rocket className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">
                    <TrendingUp className="w-6 h-6 inline" />
                  </h3>
                  <p className="text-slate-400 text-sm">Deploy Ready</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Projects */}
          {projects && projects.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">
                  Recent Projects
                </h2>
                <div className="text-sm text-slate-400">
                  {projects.length} total
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.slice(0, 6).map((project) => (
                  <Link
                    key={project._id}
                    to="/forge/editor/$projectId"
                    params={{ projectId: project._id }}
                    className="group block bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-slate-700 hover:bg-slate-900/70 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-slate-800 rounded-xl group-hover:bg-slate-700 transition-colors">
                        <Code2 className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </div>
                    </div>

                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                      {project.name}
                    </h3>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Activity className="w-3 h-3" />
                        Active
                      </div>
                      <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AuthenticationWrapper() {
  const user = useQuery(api.auth.getCurrentUser)

  return <>{user ? <App /> : <div>Loading...</div>}</>
}
