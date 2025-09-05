import { useState } from 'react'
import { useAction } from 'convex/react'
import { api } from 'convex/_generated/api'

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
  const deployToNetlify = useAction(api.netlifyDeploy.deployToNetlify)

  const handleDeploy = async () => {
    if (!projectFiles || projectFiles.length === 0) {
      console.error('No project files to deploy')
      return
    }

    setIsDeploying(true)
    setDeploymentStatus('building')
    setDeployedUrl(null)
    setErrorMessage(null)

    try {
      setDeploymentStatus('deploying')

      // Create ZIP from project files
      const zipBlob = await createZipFromFiles(projectFiles)
      console.log('ZIP created, size:', zipBlob.size)

      // Convert blob to base64 for Convex
      const zipBase64 = await blobToBase64(zipBlob)
      console.log('ZIP base64:', zipBase64)

      // Deploy to Netlify via Convex
      const deployResult = await deployToNetlify({
        zipBase64,
        siteName: projectName || 'forge-project',
      })

      setDeployedUrl(deployResult.url)
      setDeploymentStatus('success')

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
    </div>
  )
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

// Helper function to create ZIP from project files
async function createZipFromFiles(
  files: Array<{ path: string; content: string }>
): Promise<Blob> {
  try {
    console.log('Loading JSZip...')
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    console.log(`Found ${files.length} files to zip`)

    for (const { path, content } of files) {
      // Handle binary files properly (NOT svg - that's text/xml)
      if (content.startsWith('base64::')) {
        // For binary files, if content is base64 encoded
        zip.file(path, content.replace('base64::', ''), { base64: true })
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
