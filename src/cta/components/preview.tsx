import { useEffect, useRef, useState } from 'react'
import { useDryRun } from '../store/project'
import { FileSystemTree } from '@webcontainer/api'
import { useWebContainer } from '../hooks/use-web-container'
import { WebContainerState } from './web-container-provider'

// Function to process terminal output and strip ANSI codes
function processTerminalLine(text: string): string {
  // Remove all ANSI escape sequences (including color codes)
  const cleaned = text
    .replace(/\x1B\[[0-9;]*m/g, '') // Remove color/style codes
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '') // Remove cursor movement codes
    .replace(/\x1B\].*?\x07/g, '') // Remove OSC sequences
    .replace(/\x1B[()][0-2]/g, '') // Remove character set codes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim()
  
  return cleaned
}

export function BuilderPreview() {
  const dryRun = useDryRun()
  const webContainer = useWebContainer()
  const [webContainerStatus, setWebContainerStatus] = useState<WebContainerState | 'idle' | 'error' | 'ready'>('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isContainerSetup, setIsContainerSetup] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const devProcessRef = useRef<any>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

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
        // Show updating overlay when container is already setup
        if (isContainerSetup) {
          setIsUpdating(true)
          setTerminalOutput([]) // Clear previous output
        } else {
          setTerminalOutput([]) // Clear for initial setup
        }
        setStatusMessage('Updating preview...')
        
        // If container is already setup, stop the existing dev server
        if (isContainerSetup && devProcessRef.current) {
          console.log('Stopping existing dev server...')
          try {
            await devProcessRef.current.kill()
            devProcessRef.current = null
          } catch (killError) {
            console.warn('Error killing dev process:', killError)
          }
        }

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
          
          // Ensure content is a string
          let fileContent = String(content)
          
          current[fileName] = {
            file: {
              contents: fileContent
            }
          }
        })

        // Mount the files to the global webcontainer instance
        await webContainer?.mount(fileSystemTree)
        console.log('Files mounted successfully')

        // Install dependencies (use CI mode for cleaner output)
        setStatusMessage('Installing dependencies...')
        const installProcess = await webContainer!.spawn('npm', ['install', '--no-progress', '--loglevel=info', '--color=false'])

        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              const cleaned = processTerminalLine(data)
              if (cleaned) {
                setTerminalOutput(prev => [...prev, cleaned].slice(-50)) // Keep last 50 lines
              }
            },
          })
        )

        const installExitCode = await installProcess.exit
        if (installExitCode !== 0) {
          throw new Error(`npm install failed with exit code ${installExitCode}`)
        }

        console.log('Dependencies installed')
        setStatusMessage('Starting development server...')

        // Start the dev server with non-TTY environment
        const devProcess = await webContainer!.spawn('npm', ['run', 'dev'], {
          env: {
            CI: 'true',
            FORCE_COLOR: '0',
            NO_COLOR: '1'
          }
        })
        devProcessRef.current = devProcess

        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log('Dev server:', data)
              const cleaned = processTerminalLine(data)
              if (cleaned) {
                setTerminalOutput(prev => [...prev, cleaned].slice(-50)) // Keep last 50 lines
              }
            },
          })
        )

        // Only set up the server-ready listener once
        if (!isContainerSetup) {
          webContainer!.on('server-ready', (port, url) => {
            console.log(`Server ready on port ${port}, URL: ${url}`)
            setPreviewUrl(url)
            setWebContainerStatus('ready')
            setStatusMessage('Preview ready!')
            setIsUpdating(false)
          })
          setIsContainerSetup(true)
        } else {
          // For subsequent updates, just wait a bit for the server to restart
          setTimeout(() => {
            setWebContainerStatus('ready')
            setStatusMessage('Preview ready!')
            setIsUpdating(false)
          }, 2000)
        }

      } catch (error) {
        console.error('WebContainer error:', error)
        setWebContainerStatus('error')
        setStatusMessage(`Error: ${(error as Error).message}`)
        setIsUpdating(false)
      }
    }

    if (webContainer && dryRun.files) {
      console.log('Setting up web container')
      setupWebContainer()
    } else {
      console.log('Waiting for web container or dry run files', webContainer, dryRun.files)

    }
  }, [dryRun.files, webContainer, isContainerSetup])

  // Auto-scroll terminal output
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalOutput])

  return (
    <div className="relative h-full min-h-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {previewUrl && (
        <iframe
          ref={iframeRef}
          src={previewUrl}
          title="Preview"
          className="w-full h-full border-0"
        />
      )}
      
      {(webContainerStatus !== 'ready' || isUpdating) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-sm z-10">
          <div className="w-full max-w-3xl p-8 flex flex-col items-center">
            {webContainerStatus !== 'error' && statusMessage && (
              <div className="text-lg font-semibold mb-4 text-white">
                {statusMessage}
              </div>
            )}
            {webContainerStatus !== 'error' && (
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mb-6"></div>
            )}
            
            {/* Terminal Output */}
            {terminalOutput.length > 0 && webContainerStatus !== 'error' && (
              <div className="w-full bg-black/50 rounded-lg p-4 max-h-64 overflow-hidden">
                <div 
                  ref={terminalRef}
                  className="font-mono text-xs text-green-400 overflow-y-auto max-h-56 space-y-1"
                >
                  {terminalOutput.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all opacity-90">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {webContainerStatus === 'error' && (
              <div className="text-red-400 font-semibold">
                Error: {statusMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}