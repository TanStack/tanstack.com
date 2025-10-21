import { useState, useEffect, useCallback, useRef } from 'react'
import { useAction } from 'convex/react'
import { api } from 'convex/_generated/api'

interface ForgeDeployTabProps {
  projectFiles: Array<{ path: string; content: string }>
  projectName?: string
}

type DeploymentStep =
  | 'idle'
  | 'preparing'
  | 'deploying'
  | 'checking'
  | 'success'
  | 'error'

type DeploymentResult = {
  url: string
  adminUrl?: string
  claimUrl?: string
  siteId?: string
  deployId?: string
  buildId?: string
  siteName?: string
  buildStatus?: string
}

export function ForgeDeployTab({
  projectFiles,
  projectName,
}: ForgeDeployTabProps) {
  const [deploymentStep, setDeploymentStep] = useState<DeploymentStep>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [deploymentResult, setDeploymentResult] =
    useState<DeploymentResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const deployToNetlify = useAction(api.netlifyDeploy.deployToNetlify)
  const checkBuildStatus = useAction(api.netlifyDeploy.checkBuildStatus)
  const [isClaimable, setIsClaimable] = useState(false)

  // Use ref to prevent race conditions from double useEffect calls
  const isDeploying = useRef(false)
  // Ref for auto-scrolling the terminal output
  const terminalRef = useRef<HTMLDivElement>(null)

  // Helper to add terminal output
  const addTerminalOutput = useCallback((message: string) => {
    setTerminalOutput((prev) =>
      [...prev, `${new Date().toLocaleTimeString()}: ${message}`].slice(-100)
    ) // Keep last 100 lines
  }, [])

  // Auto-scroll to bottom when new terminal output is added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalOutput])

  const handleDeploy = async () => {
    if (!projectFiles || projectFiles.length === 0) {
      console.error('No project files to deploy')
      setErrorMessage('No project files to deploy')
      return
    }

    if (isDeploying.current) {
      console.log('Deployment already in progress')
      return
    }

    isDeploying.current = true
    setDeploymentStep('preparing')
    setDeploymentResult(null)
    setErrorMessage(null)
    setTerminalOutput([])
    setIsClaimable(false)

    try {
      // Step 1: Create ZIP from source files (excluding node_modules)
      setStatusMessage('Preparing deployment package...')
      addTerminalOutput('📦 Creating deployment package from source files...')
      const zipBlob = await createZipFromSourceFiles(projectFiles)
      console.log('ZIP created, size:', zipBlob.size)
      addTerminalOutput(
        `✅ Package created: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`
      )

      // Step 2: Convert blob to base64 for Convex
      setDeploymentStep('deploying')
      addTerminalOutput('🔄 Converting to base64...')
      const zipBase64 = await blobToBase64(zipBlob)

      // Step 3: Deploy to Netlify via Convex using Build API
      setStatusMessage('Deploying to Netlify...')
      addTerminalOutput('🚀 Uploading to Netlify and triggering build...')
      const deployResult = await deployToNetlify({
        zipBase64,
        siteName: projectName?.replace(/\s+/g, '_') || 'forge-project',
        deployTitle: `${
          projectName || 'TanStack Forge Project'
        } - ${new Date().toLocaleString()}`,
      })

      setDeploymentResult(deployResult)

      // Check if the site is claimable (has a claim URL)
      if (deployResult.claimUrl) {
        setIsClaimable(true)
        addTerminalOutput(`🔗 Site can be claimed at: ${deployResult.claimUrl}`)
      }

      // Step 4: Poll for build completion if we have the necessary IDs
      if (deployResult.siteId && deployResult.deployId) {
        setDeploymentStep('checking')
        setStatusMessage('Checking build status...')
        addTerminalOutput('⏳ Waiting for build to complete...')

        // Poll for build status
        let attempts = 0
        const maxAttempts = 30 // 30 seconds max
        const pollInterval = 1000 // 1 second

        const checkStatus = async () => {
          try {
            const status = await checkBuildStatus({
              siteId: deployResult.siteId!,
              deployId: deployResult.deployId!,
            })

            if (status.state === 'ready') {
              setDeploymentStep('success')
              setStatusMessage('Deployment successful!')
              addTerminalOutput(
                `✅ Build completed! Site is live at: ${
                  status.url || deployResult.url
                }`
              )
              if (status.url) {
                setDeploymentResult((prev) => ({ ...prev!, url: status.url }))
              }
              // Open deployed site in new tab
              window.open(status.url || deployResult.url, '_blank')
              return true
            } else if (status.state === 'error') {
              throw new Error(status.errorMessage || 'Build failed')
            } else {
              addTerminalOutput(`⏳ Build status: ${status.state}`)
              return false
            }
          } catch (error) {
            console.error('Error checking build status:', error)
            // If we can't check status, assume success after initial deploy
            if (attempts > 5) {
              setDeploymentStep('success')
              setStatusMessage('Deployment initiated successfully!')
              addTerminalOutput(
                `✅ Deployment initiated! URL: ${deployResult.url}`
              )
              window.open(deployResult.url, '_blank')
              return true
            }
            return false
          }
        }

        // Initial check
        const isReady = await checkStatus()
        if (!isReady && attempts < maxAttempts) {
          // Continue polling
          const pollTimer = setInterval(async () => {
            attempts++
            const ready = await checkStatus()
            if (ready || attempts >= maxAttempts) {
              clearInterval(pollTimer)
              if (attempts >= maxAttempts && !ready) {
                // Timeout - show success anyway since deploy was initiated
                setDeploymentStep('success')
                setStatusMessage('Deployment initiated successfully!')
                addTerminalOutput(
                  `✅ Deployment initiated! The build may still be processing.`
                )
                window.open(deployResult.url, '_blank')
              }
            }
          }, pollInterval)
        }
      } else {
        // No status checking available, just show success
        setDeploymentStep('success')
        setStatusMessage('Deployment successful!')
        addTerminalOutput(`✅ Deployment successful! URL: ${deployResult.url}`)
        window.open(deployResult.url, '_blank')
      }
    } catch (error) {
      console.error('Deployment error:', error)
      setDeploymentStep('error')
      setErrorMessage((error as Error).message)
      addTerminalOutput(`❌ Deployment error: ${(error as Error).message}`)
    } finally {
      isDeploying.current = false
    }
  }

  const getStepIcon = (step: DeploymentStep) => {
    switch (step) {
      case 'idle':
        return '🚀'
      case 'preparing':
        return '📦'
      case 'deploying':
        return '🚀'
      case 'checking':
        return '⏳'
      case 'success':
        return '✅'
      case 'error':
        return '❌'
    }
  }

  const getStepColor = (step: DeploymentStep) => {
    switch (step) {
      case 'error':
        return 'text-red-500'
      case 'success':
        return 'text-green-500'
      case 'idle':
        return 'text-blue-500'
      default:
        return 'text-blue-500'
    }
  }

  const getButtonText = () => {
    switch (deploymentStep) {
      case 'preparing':
        return 'Preparing files...'
      case 'deploying':
        return 'Deploying...'
      case 'checking':
        return 'Checking build status...'
      case 'success':
        return 'Deploy Again'
      case 'error':
        return 'Retry Deploy'
      default:
        return 'Deploy to Netlify'
    }
  }

  const getButtonClass = () => {
    const baseClass =
      'px-6 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'

    if (isDeploying.current) {
      return `${baseClass} bg-gray-400 text-white cursor-not-allowed`
    }

    switch (deploymentStep) {
      case 'success':
        return `${baseClass} bg-green-500 hover:bg-green-600 text-white`
      case 'error':
        return `${baseClass} bg-red-500 hover:bg-red-600 text-white`
      default:
        return `${baseClass} bg-gradient-to-r to-blue-500 from-cyan-600 hover:to-blue-600 hover:from-cyan-600 text-white`
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header with Deploy Button */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="text-3xl">{getStepIcon(deploymentStep)}</div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Build & Deploy
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Deploy your project to Netlify
              </p>
            </div>
          </div>

          <button
            onClick={handleDeploy}
            disabled={isDeploying.current}
            className={getButtonClass()}
          >
            <RocketIcon className="w-5 h-5" />
            {getButtonText()}
          </button>

          {deploymentStep !== 'idle' && statusMessage && (
            <div
              className={`mt-3 text-sm font-medium ${getStepColor(
                deploymentStep
              )}`}
            >
              {statusMessage}
            </div>
          )}

          {deploymentStep === 'success' && deploymentResult && (
            <div className="mt-3 space-y-2">
              <a
                href={deploymentResult.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-green-600 hover:text-green-700 hover:underline"
              >
                🌐 View deployed site →
              </a>
              {isClaimable && deploymentResult.claimUrl && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                  <p className="text-xs text-blue-700 dark:text-blue-400 mb-2">
                    This site can be claimed to your Netlify account:
                  </p>
                  <a
                    href={deploymentResult.claimUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Claim this site on Netlify
                  </a>
                </div>
              )}
              {deploymentResult.adminUrl && (
                <a
                  href={deploymentResult.adminUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-gray-600 dark:text-gray-400 hover:underline"
                >
                  View in Netlify Admin →
                </a>
              )}
            </div>
          )}

          {deploymentStep === 'error' && errorMessage && (
            <div className="mt-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Progress Steps */}
        {deploymentStep !== 'idle' && (
          <div className="mt-6">
            <div className="flex justify-center gap-8 text-sm">
              <div
                className={`flex items-center gap-2 ${
                  deploymentStep === 'preparing'
                    ? 'text-blue-500'
                    : deploymentStep === 'deploying' ||
                      deploymentStep === 'checking' ||
                      deploymentStep === 'success'
                    ? 'text-green-500'
                    : 'text-gray-400'
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-current"></div>
                Prepare Package
              </div>
              <div
                className={`flex items-center gap-2 ${
                  deploymentStep === 'deploying'
                    ? 'text-blue-500'
                    : deploymentStep === 'checking' ||
                      deploymentStep === 'success'
                    ? 'text-green-500'
                    : 'text-gray-400'
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-current"></div>
                Upload to Netlify
              </div>
              <div
                className={`flex items-center gap-2 ${
                  deploymentStep === 'checking'
                    ? 'text-blue-500'
                    : deploymentStep === 'success'
                    ? 'text-green-500'
                    : 'text-gray-400'
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-current"></div>
                Building on Netlify
              </div>
              <div
                className={`flex items-center gap-2 ${
                  deploymentStep === 'success'
                    ? 'text-green-500'
                    : 'text-gray-400'
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-current"></div>
                Live
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Terminal Output */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="bg-black text-green-400 font-mono text-sm rounded-lg h-full flex flex-col">
          <div className="p-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-gray-300 font-medium">Deployment Log</span>
              <button
                onClick={() => setTerminalOutput([])}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div ref={terminalRef} className="flex-1 p-4 overflow-y-auto">
            {terminalOutput.length > 0 ? (
              terminalOutput.map((line, index) => (
                <div key={index} className="mb-1 leading-relaxed">
                  {line}
                </div>
              ))
            ) : (
              <div className="text-gray-500">
                {deploymentStep === 'idle'
                  ? 'Click "Deploy to Netlify" to start deployment...'
                  : 'Waiting for output...'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to create ZIP from source files (excluding node_modules)
async function createZipFromSourceFiles(
  projectFiles: Array<{ path: string; content: string }>
): Promise<Blob> {
  try {
    console.log('Loading JSZip...')
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    console.log(`Creating zip from ${projectFiles.length} source files...`)

    // Filter out files we don't want to deploy
    const filesToZip = projectFiles.filter(({ path }) => {
      // Exclude node_modules and other build artifacts
      if (path.includes('node_modules/')) return false
      if (path.includes('.git/')) return false
      if (path.includes('dist/')) return false
      if (path.includes('.output/')) return false
      if (path.includes('.cache/')) return false
      if (path.includes('.tmp/')) return false

      // Include everything else
      return true
    })

    console.log(
      `Zipping ${filesToZip.length} files (excluded node_modules and build artifacts)`
    )

    for (const { path, content } of filesToZip) {
      // Clean up path (remove leading ./ or /)
      const cleanPath = path.replace(/^\.?\//, '')

      // Handle binary files that are base64 encoded
      if (content.startsWith('base64::')) {
        zip.file(cleanPath, content.replace('base64::', ''), { base64: true })
      } else {
        // Text files
        zip.file(cleanPath, content)
      }
    }

    console.log('Generating ZIP blob...')
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 6, // Balanced compression
      },
    })

    console.log(
      `ZIP blob generated successfully: ${(blob.size / 1024 / 1024).toFixed(
        2
      )} MB`
    )
    return blob
  } catch (error) {
    console.error('Error creating ZIP:', error)
    throw error
  }
}

// Helper function to convert blob to base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      resolve(base64.split(',')[1]) // Remove data:application/zip;base64, prefix
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Simple rocket icon component
function RocketIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v5l3-3h4l-7-7-7 7h4l3 3z"
      />
    </svg>
  )
}
