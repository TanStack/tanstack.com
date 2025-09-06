import { useState, useEffect, useCallback, useRef } from 'react'
import { useAction } from 'convex/react'
import { api } from 'convex/_generated/api'
import { useWebContainer } from '~/forge/hooks/use-web-container'
import type { FileSystemTree } from '@webcontainer/api'

interface ForgeDeployTabProps {
  projectFiles: Array<{ path: string; content: string }>
  projectName?: string
}

type DeploymentStep =
  | 'idle'
  | 'mounting'
  | 'installing'
  | 'building'
  | 'deploying'
  | 'success'
  | 'error'

export function ForgeDeployTab({
  projectFiles,
  projectName,
}: ForgeDeployTabProps) {
  const webContainer = useWebContainer()
  const [deploymentStep, setDeploymentStep] = useState<DeploymentStep>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const deployToNetlify = useAction(api.netlifyDeploy.deployToNetlify)

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

  const processTerminalLine = (data: string): string => {
    // Simple clean up of terminal output - remove common ANSI codes
    let cleaned = data

    // Remove common ANSI escape sequences
    cleaned = cleaned.replace(/\u001b\[[\d;]*m/g, '') // Color codes
    cleaned = cleaned.replace(/\u001b\[[\d;]*[A-Za-z]/g, '') // Cursor/display codes
    cleaned = cleaned.replace(/\u001b\][\d;]*;[^\u0007]*\u0007/g, '') // Title codes

    // Remove non-printable characters except newlines and tabs
    cleaned = cleaned.replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g,
      ''
    )

    return cleaned.trim()
  }

  const handleDeploy = async () => {
    if (!projectFiles || projectFiles.length === 0) {
      console.error('No project files to deploy')
      setErrorMessage('No project files to deploy')
      return
    }

    if (!webContainer) {
      console.error('WebContainer not ready')
      setErrorMessage('WebContainer not ready. Please try again.')
      return
    }

    if (isDeploying.current) {
      console.log('Deployment already in progress')
      return
    }

    isDeploying.current = true
    setDeploymentStep('mounting')
    setDeployedUrl(null)
    setErrorMessage(null)
    setTerminalOutput([])

    try {
      // Step 1: Set up webcontainer with project files
      setStatusMessage('Setting up project files...')
      addTerminalOutput('📁 Setting up project files...')
      await setupWebContainerFiles(webContainer, projectFiles)

      // Step 2: Install dependencies
      setDeploymentStep('installing')
      setStatusMessage('Installing dependencies...')
      addTerminalOutput('📦 Installing dependencies...')
      await installDependencies(
        webContainer,
        addTerminalOutput,
        processTerminalLine
      )

      // Step 3: Build the project
      setDeploymentStep('building')
      setStatusMessage('Building project...')
      addTerminalOutput('🔨 Building project...')
      await buildProject(webContainer, addTerminalOutput, processTerminalLine)

      // Step 4: Create ZIP from build output
      setDeploymentStep('deploying')
      setStatusMessage('Creating deployment package...')
      addTerminalOutput('📦 Creating deployment package...')
      const zipBlob = await createZipFromWebContainer(webContainer)
      console.log('ZIP created, size:', zipBlob.size)

      // Step 5: Convert blob to base64 for Convex
      addTerminalOutput('🔄 Converting to base64...')
      const zipBase64 = await blobToBase64(zipBlob)

      // Step 6: Deploy to Netlify via Convex
      addTerminalOutput('🚀 Deploying to Netlify...')
      const deployResult = await deployToNetlify({
        zipBase64,
        siteName: projectName?.replace(/\s+/g, '_') || 'forge-project',
      })

      setDeployedUrl(deployResult.url)
      setDeploymentStep('success')
      setStatusMessage('Deployment successful!')
      addTerminalOutput(`✅ Deployment successful! URL: ${deployResult.url}`)

      // Open deployed site in new tab
      window.open(deployResult.url, '_blank')
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
      case 'mounting':
        return '📁'
      case 'installing':
        return '📦'
      case 'building':
        return '🔨'
      case 'deploying':
        return '🚀'
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
      case 'mounting':
        return 'Setting up files...'
      case 'installing':
        return 'Installing dependencies...'
      case 'building':
        return 'Building...'
      case 'deploying':
        return 'Deploying...'
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

  if (!webContainer) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <div className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Initializing WebContainer...
          </div>
        </div>
      </div>
    )
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

          {deploymentStep === 'success' && deployedUrl && (
            <div className="mt-3">
              <a
                href={deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-600 hover:text-green-700 hover:underline"
              >
                🌐 View deployed site →
              </a>
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
                  deploymentStep === 'mounting'
                    ? 'text-blue-500'
                    : deploymentStep === 'installing' ||
                      deploymentStep === 'building' ||
                      deploymentStep === 'deploying' ||
                      deploymentStep === 'success'
                    ? 'text-green-500'
                    : 'text-gray-400'
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-current"></div>
                Setup Files
              </div>
              <div
                className={`flex items-center gap-2 ${
                  deploymentStep === 'installing'
                    ? 'text-blue-500'
                    : deploymentStep === 'building' ||
                      deploymentStep === 'deploying' ||
                      deploymentStep === 'success'
                    ? 'text-green-500'
                    : 'text-gray-400'
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-current"></div>
                Install Dependencies
              </div>
              <div
                className={`flex items-center gap-2 ${
                  deploymentStep === 'building'
                    ? 'text-blue-500'
                    : deploymentStep === 'deploying' ||
                      deploymentStep === 'success'
                    ? 'text-green-500'
                    : 'text-gray-400'
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-current"></div>
                Build Project
              </div>
              <div
                className={`flex items-center gap-2 ${
                  deploymentStep === 'deploying'
                    ? 'text-blue-500'
                    : deploymentStep === 'success'
                    ? 'text-green-500'
                    : 'text-gray-400'
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-current"></div>
                Deploy to Netlify
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

// Helper function to set up webcontainer with project files
async function setupWebContainerFiles(
  webContainer: any,
  projectFiles: Array<{ path: string; content: string }>
): Promise<void> {
  // Build FileSystemTree from project files
  const fileSystemTree: FileSystemTree = {}

  projectFiles.forEach(({ path, content }) => {
    // Clean and split the path
    const cleanPath = path.replace(/^\.?\//, '')
    const pathParts = cleanPath.split('/')

    // Navigate to the correct location in the tree
    let current: any = fileSystemTree

    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i]
      if (!current[part]) {
        current[part] = { directory: {} }
      }
      current = current[part].directory
    }

    // Add the file
    const fileName = pathParts[pathParts.length - 1]
    if (content.startsWith('base64::')) {
      current[fileName] = {
        file: {
          contents: content.replace('base64::', ''),
          encoding: 'base64',
        },
      }
    } else {
      current[fileName] = {
        file: {
          contents: String(content),
        },
      }
    }
  })

  // Mount the files to the webcontainer
  await webContainer.mount(fileSystemTree)
  console.log('Files mounted successfully')
}

// Helper function to install dependencies
async function installDependencies(
  webContainer: any,
  addTerminalOutput: (message: string) => void,
  processTerminalLine: (data: string) => string
): Promise<void> {
  const installProcess = await webContainer.spawn('pnpm', ['install'])

  installProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        const cleaned = processTerminalLine(data)
        if (cleaned) {
          addTerminalOutput(cleaned)
        }
      },
    })
  )

  const installExitCode = await installProcess.exit
  if (installExitCode !== 0) {
    throw new Error(`pnpm install failed with exit code ${installExitCode}`)
  }
  console.log('Dependencies installed')
}

// Helper function to build the project
async function buildProject(
  webContainer: any,
  addTerminalOutput: (message: string) => void,
  processTerminalLine: (data: string) => string
): Promise<void> {
  const buildProcess = await webContainer.spawn('npm', ['run', 'build'], {
    env: {
      CI: 'true',
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
  })

  let buildCompleted = false
  const buildPromise = new Promise<void>((resolve, reject) => {
    buildProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          const cleaned = processTerminalLine(data)
          if (cleaned) {
            addTerminalOutput(cleaned)
          }
          console.log(
            'cleaned',
            cleaned,
            cleaned.includes('successfully built')
          )

          if (cleaned && cleaned.includes('successfully built')) {
            console.log('Resolved promise')
            buildCompleted = true
            resolve()
          }
        },
      })
    )
  })

  // Wait for build to complete or timeout
  await Promise.race([
    buildPromise,
    new Promise((_, reject) => {
      setTimeout(() => {
        if (!buildCompleted) {
          reject(new Error('Build process timed out'))
        }
      }, 60000) // 60 second timeout
    }),
  ])

  console.log('Got to the end of the build promise')

  // const buildExitCode = await buildProcess.exit
  // if (buildExitCode !== 0) {
  //   throw new Error(`Build failed with exit code ${buildExitCode}`)
  // }
  console.log('Build completed successfully')
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

// Helper function to create ZIP from webcontainer build output
async function createZipFromWebContainer(webContainer: any): Promise<Blob> {
  try {
    console.log('Loading JSZip...')
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    console.log('Reading dist directory...')
    // Read the dist directory from the web container
    const distFiles = await readDistDirectory(webContainer)

    console.log(`Found ${Object.keys(distFiles).length} files to zip`)

    for (const [path, content] of Object.entries(distFiles)) {
      // Handle binary files properly (NOT svg - that's text/xml)
      if (path.match(/\.(jpg|jpeg|png|gif|ico|woff|woff2|ttf|eot|pdf)$/i)) {
        // For binary files, content is already base64 encoded
        zip.file(path, content, { base64: true })
      } else {
        // For text files (js, css, html, svg, json, etc)
        zip.file(path, content as string)
      }
    }

    console.log('Generating ZIP blob...')
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
    })
    console.log('ZIP blob generated successfully')
    return blob
  } catch (error) {
    console.error('Error creating ZIP:', error)
    throw error
  }
}

// Helper function to read the dist directory from webcontainer
async function readDistDirectory(
  webContainer: any
): Promise<Record<string, string | ArrayBuffer>> {
  const files: Record<string, string | ArrayBuffer> = {}

  // Read all files in the dist directory
  async function readDir(path: string) {
    try {
      const dirContents = await webContainer.fs.readdir(path, {
        withFileTypes: true,
      })

      for (const item of dirContents) {
        const fullPath = `${path}/${item.name}`

        if (item.isDirectory()) {
          await readDir(fullPath)
        } else {
          try {
            // Check if it's a binary file (NOT js/css - those are text!)
            const isBinary = fullPath.match(
              /\.(jpg|jpeg|png|gif|ico|woff|woff2|ttf|eot|pdf)$/i
            )

            if (isBinary) {
              // Read binary files as base64
              const content = await webContainer.fs.readFile(fullPath, 'base64')
              const relativePath = fullPath.replace(/^dist\//, '')
              files[relativePath] = content
            } else {
              // Read text files as UTF-8 (includes .js, .css, .html, .svg, etc)
              const content = await webContainer.fs.readFile(fullPath, 'utf-8')
              const relativePath = fullPath.replace(/^dist\//, '')
              files[relativePath] = content
            }
          } catch (fileError) {
            console.error(`Error reading file ${fullPath}:`, fileError)
          }
        }
      }
    } catch (dirError) {
      console.error(`Error reading directory ${path}:`, dirError)
      throw dirError
    }
  }

  await readDir('.output')
  return files
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
