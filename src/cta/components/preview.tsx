import { useEffect, useRef, useState } from 'react'
import { useDryRun } from '../store/project'
import { FileSystemTree } from '@webcontainer/api'
import { useWebContainer } from '../hooks/use-web-container'
import { WebContainerState } from './web-container-provider'

export function BuilderPreview() {
  const dryRun = useDryRun()
  const webContainer = useWebContainer()
  const [webContainerStatus, setWebContainerStatus] = useState<WebContainerState | 'idle' | 'error' | 'ready'>('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const setupWebContainer = async () => {
      if (!webContainer) {
        console.log('No web container available yet')
        return
      }

      if (!dryRun?.files || Object.keys(dryRun.files).length === 0) {
        console.log('No dry run files available yet')
        return
      }

      try {


        // Build FileSystemTree from dry run files
        const fileSystemTree: FileSystemTree = {}

        Object.entries(dryRun.files).forEach(([path, content]) => {
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
              contents: content as string
            }
          }
        })

        // Mount the files to the global webcontainer instance
        await webContainer?.mount(fileSystemTree)
        console.log('Files mounted successfully')



        // Install dependencies
        const installProcess = await webContainer!.spawn('npm', ['install'])

        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log('Install:', data)
            },
          })
        )

        const installExitCode = await installProcess.exit
        if (installExitCode !== 0) {
          throw new Error(`npm install failed with exit code ${installExitCode}`)
        }

        console.log('Dependencies installed')
        setStatusMessage('Starting development server...')

        // Start the dev server
        const devProcess = await webContainer!.spawn('npm', ['run', 'dev'])

        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log('Dev server:', data)
            },
          })
        )

        // Wait for server ready event
        webContainer!.on('server-ready', (port, url) => {
          console.log(`Server ready on port ${port}, URL: ${url}`)
          setPreviewUrl(url)
          setWebContainerStatus('ready')
          setStatusMessage('Preview ready!')
        })

      } catch (error) {
        console.error('WebContainer error:', error)
        setWebContainerStatus('error')
        setStatusMessage(`Error: ${(error as Error).message}`)
      }
    }

    if (webContainer && dryRun.files) {
      console.log('Setting up web container')
      setupWebContainer()
    } else {
      console.log('Waiting for web container or dry run files', webContainer, dryRun.files)

    }
  }, [dryRun.files, webContainer])

  return (

    <div className="flex-1 relative bg-gray-900">
      {webContainerStatus !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm z-10">
          <div className="text-center p-8">
            {webContainerStatus !== 'error' && (
              <div className="text-lg font-semibold mb-3">
                {statusMessage}
              </div>
            )}
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
            {webContainerStatus === 'error' && (
              <div className="text-red-500 mt-2">
                Error: {statusMessage}
              </div>
            )}
          </div>
        </div>
      )}
      {previewUrl ? (
        <iframe
          ref={iframeRef}
          src={previewUrl}
          title="Preview"
          className="w-full h-full border-0"
        />
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <div className="text-lg mb-2">Preview will appear here</div>
            <div className="text-sm">Configure your project to see a live preview</div>
          </div>
        </div>
      )}
    </div>
  )
}