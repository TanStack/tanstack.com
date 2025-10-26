'use client'

import { useState } from 'react'
import { useDeploymentStore } from '../store/deployment'
import { useDryRun, useProjectName } from '../store/project'
import { RocketIcon } from './icons/rocket'
import { useAction } from 'convex/react'
import { api } from 'convex/_generated/api'

export function PublishButton() {
  const [isDeploying, setIsDeploying] = useState(false)
  const dryRun = useDryRun()
  const projectName = useProjectName()
  const deployToNetlify = useAction(api.netlifyDeploy.deployToNetlify)
  const {
    setStatus,
    setMessage,
    clearTerminalOutput,
    addTerminalOutput,
    setDeployedUrl,
    setClaimUrl,
    setErrorMessage,
    status,
  } = useDeploymentStore()

  const handlePublish = async () => {
    if (!dryRun?.files) {
      console.error('Project files not ready')
      return
    }

    setIsDeploying(true)
    clearTerminalOutput()
    setStatus('deploying')
    setMessage('Preparing deployment package...')
    setDeployedUrl(null)
    setClaimUrl(null)
    setErrorMessage(null)

    try {
      addTerminalOutput('📦 Creating deployment package from source files...')

      // Create ZIP from source files (let Netlify build it)
      const zipBlob = await createZipFromSourceFiles(dryRun.files)
      addTerminalOutput(
        `✅ Package created: ${(zipBlob.size / 1024 / 1024).toFixed(2)} MB`
      )

      console.log('ZIP created, size:', zipBlob.size)

      setMessage('Deploying to Netlify...')
      addTerminalOutput('🚀 Uploading to Netlify and triggering build...')

      // Convert blob to base64 for Convex
      const zipBase64 = await blobToBase64(zipBlob)

      // Deploy to Netlify via Convex (uploads source, Netlify builds it)
      const deployResult = await deployToNetlify({
        zipBase64,
        siteName: projectName || 'tanstack-app',
      })

      setDeployedUrl(deployResult.url)
      setClaimUrl(deployResult.claimUrl)
      setStatus('success')
      setMessage('Deployed! Netlify is building your app...')
      addTerminalOutput('✅ Source code uploaded successfully')
      addTerminalOutput('🏗️  Netlify is now building your application...')
      addTerminalOutput(`🌐 Site URL: ${deployResult.url}`)

      if (deployResult.claimUrl) {
        addTerminalOutput(`🔗 Claim your site at: ${deployResult.claimUrl}`)
      } else if (deployResult.adminUrl) {
        addTerminalOutput(`⚙️  Manage your site at: ${deployResult.adminUrl}`)
      }
    } catch (error) {
      console.error('Deployment error:', error)
      setStatus('error')
      setErrorMessage((error as Error).message)
      addTerminalOutput(`❌ Deployment failed: ${(error as Error).message}`)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <button
      onClick={handlePublish}
      disabled={isDeploying || status === 'deploying'}
      className="bg-gradient-to-r to-blue-500 from-cyan-600 hover:to-blue-600 hover:from-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200"
    >
      <RocketIcon className="w-4 h-4" />
      {isDeploying ? 'Publishing...' : 'Publish'}
    </button>
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

// Helper function to create ZIP from source files (excluding node_modules and build artifacts)
async function createZipFromSourceFiles(
  projectFiles: Record<string, string>
): Promise<Blob> {
  try {
    console.log('Loading JSZip...')
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    const fileEntries = Object.entries(projectFiles)
    console.log(`Creating zip from ${fileEntries.length} source files...`)

    // Filter out files we don't want to deploy
    const filesToZip = fileEntries.filter(([path]) => {
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

    for (const [path, content] of filesToZip) {
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
