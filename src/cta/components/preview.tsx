import { useEffect, useRef, useState } from 'react'
import { useDryRun } from '../store/project'
import { FileSystemTree } from '@webcontainer/api'
import { useWebContainer } from '../hooks/use-web-container'
import { WebContainerState } from './web-container-provider'
import { useDeploymentStore } from '../store/deployment'
import { useDevServerStore } from '../store/dev-server'

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
  const [webContainerStatus, setWebContainerStatus] = useState<
    WebContainerState | 'idle' | 'error' | 'ready'
  >('idle')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isContainerSetup, setIsContainerSetup] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [terminalOutput, setTerminalOutput] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const devProcessRef = useRef<any>(null)

  // Dev server store
  const { setDevProcess, setIsRunning } = useDevServerStore()

  // Deployment store
  const deploymentStore = useDeploymentStore()
  const isDeploying =
    deploymentStore.status === 'building' ||
    deploymentStore.status === 'deploying'

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
            setDevProcess(null)
            setIsRunning(false)
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
              contents: fileContent,
            },
          }
        })

        // Mount the files to the global webcontainer instance
        await webContainer?.mount(fileSystemTree)
        console.log('Files mounted successfully')

        // Install dependencies (use CI mode for cleaner output)
        setStatusMessage('Installing dependencies...')
        const installProcess = await webContainer!.spawn('npm', [
          'install',
          '--no-progress',
          '--loglevel=info',
          '--color=false',
        ])

        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              const cleaned = processTerminalLine(data)
              if (cleaned) {
                setTerminalOutput((prev) => [...prev, cleaned].slice(-50)) // Keep last 50 lines
              }
            },
          })
        )

        const installExitCode = await installProcess.exit
        if (installExitCode !== 0) {
          throw new Error(
            `npm install failed with exit code ${installExitCode}`
          )
        }

        console.log('Dependencies installed')
        setStatusMessage('Starting development server...')

        // Start the dev server with non-TTY environment
        const devProcess = await webContainer!.spawn('npm', ['run', 'dev'], {
          env: {
            CI: 'true',
            FORCE_COLOR: '0',
            NO_COLOR: '1',
          },
        })
        devProcessRef.current = devProcess
        setDevProcess(devProcess)
        setIsRunning(true)

        devProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              console.log('Dev server:', data)
              const cleaned = processTerminalLine(data)
              if (cleaned) {
                setTerminalOutput((prev) => [...prev, cleaned].slice(-50)) // Keep last 50 lines
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
      console.log(
        'Waiting for web container or dry run files',
        webContainer,
        dryRun.files
      )
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

      {(webContainerStatus !== 'ready' ||
        isUpdating ||
        isDeploying ||
        deploymentStore.status === 'success') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-sm z-10">
          <div className="w-full max-w-3xl p-8 flex flex-col items-center">
            {/* Deployment Status - Only show during deployment, not on success */}
            {isDeploying && deploymentStore.status !== 'success' && (
              <>
                <div className="text-lg font-semibold mb-4 text-white">
                  {deploymentStore.message}
                </div>
                {deploymentStore.status !== 'error' && (
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent mb-6"></div>
                )}

                {/* Deployment Terminal Output */}
                {deploymentStore.terminalOutput.length > 0 &&
                  deploymentStore.status !== 'error' && (
                    <div className="w-full bg-black/50 rounded-lg p-4 max-h-64 overflow-hidden">
                      <div
                        ref={terminalRef}
                        className="font-mono text-xs text-green-400 overflow-y-auto max-h-56 space-y-1"
                      >
                        {deploymentStore.terminalOutput.map((line, i) => (
                          <div
                            key={i}
                            className="whitespace-pre-wrap break-all opacity-90"
                          >
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {deploymentStore.status === 'error' && (
                  <div className="text-red-400 font-semibold">
                    Error: {deploymentStore.errorMessage}
                  </div>
                )}
              </>
            )}

            {/* Regular WebContainer Status - Don't show when deployment is successful */}
            {!isDeploying && deploymentStore.status !== 'success' && (
              <>
                {webContainerStatus !== 'error' && statusMessage && (
                  <div className="text-lg font-semibold mb-4 text-white">
                    {statusMessage}
                  </div>
                )}
                {webContainerStatus !== 'error' && (
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mb-6"></div>
                )}

                {/* Terminal Output */}
                {terminalOutput.length > 0 &&
                  webContainerStatus !== 'error' && (
                    <div className="w-full bg-black/50 rounded-lg p-4 max-h-64 overflow-hidden">
                      <div
                        ref={terminalRef}
                        className="font-mono text-xs text-green-400 overflow-y-auto max-h-56 space-y-1"
                      >
                        {terminalOutput.map((line, i) => (
                          <div
                            key={i}
                            className="whitespace-pre-wrap break-all opacity-90"
                          >
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
              </>
            )}

            {/* Success State */}
            {deploymentStore.status === 'success' &&
              deploymentStore.deployedUrl && (
                <div className="w-full max-w-2xl">
                  <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border border-green-500/50 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold text-green-400">
                        🎉 Publish Complete!
                      </h3>
                      <button
                        onClick={() => deploymentStore.reset()}
                        className="text-white hover:text-white transition-colors"
                        aria-label="Close"
                      >
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="text-white mb-1">
                          Your site is live at:
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 flex items-center bg-black/30 rounded-lg overflow-hidden">
                            <a
                              href={deploymentStore.deployedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white font-mono text-sm px-3 py-2 flex-1 hover:bg-black/10 transition-colors truncate"
                              title={deploymentStore.deployedUrl}
                            >
                              {deploymentStore.deployedUrl}
                            </a>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  deploymentStore.deployedUrl!
                                )
                                setCopied(true)
                                setTimeout(() => setCopied(false), 2000)
                              }}
                              className="px-3 py-2 hover:bg-black/20 transition-colors group relative border-l border-gray-700/50"
                              title="Copy URL"
                            >
                              {copied ? (
                                <svg
                                  className="w-5 h-5 text-green-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="w-5 h-5 text-gray-400 group-hover:text-white"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                              )}
                              {copied && (
                                <span className="absolute -top-8 right-0 bg-gray-800 text-xs text-white px-2 py-1 rounded">
                                  Copied!
                                </span>
                              )}
                            </button>
                          </div>
                          <a
                            href={deploymentStore.deployedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-transparent text-white  px-2 py-1 rounded-lg text-sm ring-1 ring-white-700 font-semibold transition-colors"
                          >
                            Visit Site →
                          </a>
                        </div>
                      </div>

                      {/* Claim Deployment Button */}
                      {deploymentStore.claimUrl && (
                        <div>
                          <div className="text-white mt-10 mb-2">
                            🔔 <strong>Note:</strong> This is an unclaimed
                            deployment. <br />
                          </div>
                          <div className="text-white mt-2 mb-3">
                            Claim it to manage settings, custom domains, and
                            more:
                          </div>
                          <a
                            href={deploymentStore.claimUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-gradient-to-r to-blue-500 from-cyan-600 hover:to-blue-600 hover:from-cyan-600 text-white text-shadow-md text-shadow-discord  px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                          >
                            <svg
                              className="w-5 h-5 drop-shadow-sm"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                              />
                            </svg>
                            Claim Deployment on Netlify
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
