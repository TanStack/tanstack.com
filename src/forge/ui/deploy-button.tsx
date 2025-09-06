import { useState, useEffect } from 'react'
import { useAction } from 'convex/react'
import { api } from 'convex/_generated/api'
import { useWebContainer } from '~/forge/hooks/use-web-container'
import type { FileSystemTree } from '@webcontainer/api'
interface ForgeDeployButtonProps {
  projectFiles: Array<{ path: string; content: string }>
  projectName?: string
  disabled?: boolean
}

export function ForgeDeployButton({
  projectFiles,
  projectName,
  disabled,
}: ForgeDeployButtonProps) {
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentStatus, setDeploymentStatus] = useState<
    'idle' | 'building' | 'deploying' | 'success' | 'error'
  >('idle')
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const webContainer = useWebContainer()
  const deployToNetlify = useAction(api.netlifyDeploy.deployToNetlify)

  const handleDeploy = async () => {
    if (!projectFiles || projectFiles.length === 0) {
      console.error('No project files to deploy')
      return
    }

    if (!webContainer) {
      console.error('WebContainer not ready')
      setErrorMessage('WebContainer not ready. Please try again.')
      return
    }

    setIsDeploying(true)
    setDeploymentStatus('building')
    setDeployedUrl(null)
    setErrorMessage(null)
    setTerminalOutput([])

    try {
      // Step 1: Set up webcontainer with project files
      setStatusMessage('Setting up project files...')
      await setupWebContainerFiles(webContainer, projectFiles)

      // Step 2: Install dependencies
      setStatusMessage('Installing dependencies...')
      await installDependencies(webContainer)

      // Step 3: Build the project
      setStatusMessage('Building project...')
      await buildProject(webContainer)

      // Step 4: Create ZIP from build output
      setDeploymentStatus('deploying')
      setStatusMessage('Creating deployment package...')
      const zipBlob = await createZipFromWebContainer(webContainer)
      console.log('ZIP created, size:', zipBlob.size)

      // Step 5: Convert blob to base64 for Convex
      const zipBase64 = await blobToBase64(zipBlob)

      // Step 6: Deploy to Netlify via Convex
      const deployResult = await deployToNetlify({
        zipBase64,
        siteName: projectName?.replace(/\s+/g, '_') || 'forge-project',
      })

      setDeployedUrl(deployResult.url)
      setDeploymentStatus('success')
      setStatusMessage('Deployment successful!')

      // Open deployed site in new tab
      window.open(deployResult.url, '_blank')
    } catch (error) {
      console.error('Deployment error:', error)
      setDeploymentStatus('error')
      setErrorMessage((error as Error).message)
    } finally {
      setIsDeploying(false)
    }
  }

  const getButtonText = () => {
    switch (deploymentStatus) {
      case 'building':
        return 'Building...'
      case 'deploying':
        return 'Deploying...'
      case 'success':
        return 'Deploy Again'
      case 'error':
        return 'Retry Deploy'
      default:
        return 'Deploy'
    }
  }

  const getButtonClass = () => {
    const baseClass =
      'px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200'

    if (disabled || isDeploying) {
      return `${baseClass} opacity-50 cursor-not-allowed bg-gray-400 text-white`
    }

    switch (deploymentStatus) {
      case 'success':
        return `${baseClass} bg-green-500 hover:bg-green-600 text-white`
      case 'error':
        return `${baseClass} bg-red-500 hover:bg-red-600 text-white`
      default:
        return `${baseClass} bg-gradient-to-r to-blue-500 from-cyan-600 hover:to-blue-600 hover:from-cyan-600 text-white`
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleDeploy}
        disabled={disabled || isDeploying}
        className={getButtonClass()}
      >
        <RocketIcon className="w-4 h-4" />
        {getButtonText()}
      </button>

      {deploymentStatus === 'success' && deployedUrl && (
        <div className="mt-1 text-xs text-green-600">
          <a
            href={deployedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            View deployed site →
          </a>
        </div>
      )}

      {deploymentStatus === 'error' && errorMessage && (
        <div className="mt-1 text-xs text-red-600 max-w-xs">{errorMessage}</div>
      )}

      {(deploymentStatus === 'building' || deploymentStatus === 'deploying') &&
        statusMessage && (
          <div className="mt-1 text-xs text-blue-600 max-w-xs">
            {statusMessage}
          </div>
        )}
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
    current[fileName] = {
      file: {
        contents: String(content),
      },
    }
  })

  // Mount the files to the webcontainer
  await webContainer.mount(fileSystemTree)
  console.log('Files mounted successfully')
}

// Helper function to install dependencies
async function installDependencies(webContainer: any): Promise<void> {
  const installProcess = await webContainer.spawn('npm', [
    'install',
    '--no-progress',
    '--loglevel=info',
    '--color=false',
  ])

  const installExitCode = await installProcess.exit
  if (installExitCode !== 0) {
    throw new Error(`npm install failed with exit code ${installExitCode}`)
  }
  console.log('Dependencies installed')
}

// Helper function to build the project
async function buildProject(webContainer: any): Promise<void> {
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
          const cleaned = data
            .replace(/\x1B\[[0-9;]*m/g, '')
            .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
            .replace(/\x1B\].*?\x07/g, '')
            .replace(/\x1B[()][0-2]/g, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .trim()

          if (
            cleaned &&
            (cleaned.includes('✓ built in') || cleaned.includes('built in'))
          ) {
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

  const buildExitCode = await buildProcess.exit
  if (buildExitCode !== 0) {
    throw new Error(`Build failed with exit code ${buildExitCode}`)
  }
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

  await readDir('dist')
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
