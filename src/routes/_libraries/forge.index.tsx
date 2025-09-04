import { useQuery } from 'convex/react'
import { useState, useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'

import { api } from 'convex/_generated/api'
import { getLLMKeys, hasActiveKeys } from '~/utils/llmKeys'

import Sidebar from '~/forge/ui/sidebar'

export const Route = createFileRoute({
  ssr: false,
  component: AuthenticationWrapper,
})

function App() {
  const projects = useQuery(api.forge.getProjects)
  const [description, setDescription] = useState('')
  const [llmKeys, setLlmKeys] = useState<any[]>([])
  const [keysLoaded, setKeysLoaded] = useState(false)

  const router = useRouter()

  // Load LLM keys from localStorage
  useEffect(() => {
    setLlmKeys(getLLMKeys())
    setKeysLoaded(true)
  }, [])

  // Check if user has any active LLM keys
  const hasActiveKeysCheck = keysLoaded && hasActiveKeys()

  const handleGetStarted = async () => {
    const res = await fetch('/api/forge/new-project', {
      method: 'POST',
      body: JSON.stringify({ description, llmKeys }),
    })
    const { projectId } = await res.json()
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
  if (!keysLoaded) {
    return (
      <div className="flex flex-col md:flex-row h-screen bg-background w-full">
        <Sidebar projects={projects} />
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  // Show key requirement message if no active keys
  if (!hasActiveKeysCheck) {
    return (
      <div className="flex flex-col md:flex-row h-screen bg-background w-full">
        <Sidebar projects={projects} />
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
          <div className="w-full max-w-2xl space-y-4 md:space-y-6 text-center">
            <div className="text-6xl mb-4">🔑</div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              LLM API Keys Required
            </h1>
            <p className="text-muted-foreground">
              To use the Forge, you need to add your own LLM API keys. We
              support OpenAI and Anthropic.
            </p>
            <div className="flex justify-center">
              <Link
                to="/account"
                className="px-6 md:px-8 py-2 md:py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors text-sm md:text-base"
              >
                Add API Keys
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background w-full">
      <Sidebar projects={projects} />

      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl space-y-4 md:space-y-6">
          <h1 className="text-2xl md:text-3xl font-bold text-center text-foreground">
            What do you want to build today?
          </h1>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your project idea..."
            className="w-full h-24 md:h-32 p-3 md:p-4 border border-border rounded-lg resize-none bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-sm md:text-base"
          />

          <div className="flex justify-center">
            <button
              onClick={handleGetStarted}
              className="px-6 md:px-8 py-2 md:py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors text-sm md:text-base"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AuthenticationWrapper() {
  const user = useQuery(api.auth.getCurrentUser)

  return <>{user ? <App /> : <div>Loading...</div>}</>
}
