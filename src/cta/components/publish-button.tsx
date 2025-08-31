'use client'

import { useState } from 'react'
import { useDeploymentStore } from '../store/deployment'
import { useDryRun, useProjectName } from '../store/project'
import { useWebContainer } from '../hooks/use-web-container'
import { useDevServerStore } from '../store/dev-server'
import { RocketIcon } from './icons/rocket'
import { useAction } from 'convex/react'
import { api } from 'convex/_generated/api'

export function PublishButton() {
  const [isDeploying, setIsDeploying] = useState(false)
  const dryRun = useDryRun()
  const projectName = useProjectName()
  const webContainer = useWebContainer()
  const deployToNetlify = useAction(api.netlifyDeploy.deployToNetlify)
  const { stopDevServer, setDevProcess, setIsRunning } = useDevServerStore()
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
    if (!webContainer || !dryRun?.files) {
      console.error('WebContainer or files not ready')
      return
    }

    setIsDeploying(true)
    clearTerminalOutput()
    setStatus('building')
    setMessage('Stopping dev server...')
    setDeployedUrl(null)
    setClaimUrl(null)
    setErrorMessage(null)

    try {
      // Stop the dev server before building
      await stopDevServer()

      setMessage('Building App...')
      // Build the app in the web container
      const buildProcess = await webContainer.spawn('npm', ['run', 'build'], {
        env: {
          CI: 'true',
          FORCE_COLOR: '0',
          NO_COLOR: '1',
        },
      })

      let buildPromise = new Promise<void>((resolve) => {
        // Capture build output
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

              if (cleaned) {
                addTerminalOutput(cleaned)
              }

              if (cleaned.includes('✓ built in')) {
                resolve()
              }
            },
          })
        )
      })

      await Promise.race([
        buildPromise,
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Build process timed out'))
          }, 30000)
        }),
      ])

      console.log('Build completed successfully, creating ZIP...')

      // After successful build, create ZIP and deploy
      setStatus('deploying')
      setMessage('Creating deployment package...')

      // Create ZIP from build output
      const zipBlob = await createZipFromWebContainer(webContainer)

      console.log('ZIP created, size:', zipBlob.size)

      setMessage('Deploying to Netlify...')

      // Convert blob to base64 for Convex
      const zipBase64 = await blobToBase64(zipBlob)

      // Deploy to Netlify via Convex
      const deployResult = await deployToNetlify({
        zipBase64,
        siteName: projectName || 'tanstack-app',
      })

      setDeployedUrl(deployResult.url)
      setClaimUrl(deployResult.claimUrl)
      setStatus('success')
      setMessage('Publish Complete!')

      // Restart the dev server after successful deployment
      console.log('Restarting dev server...')
      const devProcess = await webContainer.spawn('npm', ['run', 'dev'], {
        env: {
          CI: 'true',
          FORCE_COLOR: '0',
          NO_COLOR: '1',
        },
      })
      setDevProcess(devProcess)
      setIsRunning(true)
    } catch (error) {
      console.error('Deployment error:', error)
      setStatus('error')
      setErrorMessage((error as Error).message)

      // Restart dev server even on error
      try {
        console.log('Restarting dev server after error...')
        const devProcess = await webContainer.spawn('npm', ['run', 'dev'], {
          env: {
            CI: 'true',
            FORCE_COLOR: '0',
            NO_COLOR: '1',
          },
        })
        setDevProcess(devProcess)
        setIsRunning(true)
      } catch (restartError) {
        console.error('Failed to restart dev server:', restartError)
      }
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <button
      onClick={handlePublish}
      disabled={isDeploying || status === 'building' || status === 'deploying'}
      className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-200"
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

// Helper function to create ZIP from web container
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
