import { useMemo } from 'react'
import { useDryRun } from '../store/project'
import { useDeploymentStore } from '../store/deployment'
import { WebContainerPreview } from '../sandbox/webcontainer-preview'

/**
 * BuilderPreview - Wrapper component that displays the preview
 * Assumes WebContainerProvider is already wrapping this component
 */
export function BuilderPreview() {
  const dryRun = useDryRun()
  const deploymentStore = useDeploymentStore()

  const isDeploying =
    deploymentStore.status === 'building' ||
    deploymentStore.status === 'deploying'

  // Show deployment overlay
  if (isDeploying || deploymentStore.status === 'success') {
    return (
      <div className="relative h-full min-h-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
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
                      <div className="font-mono text-xs text-green-400 overflow-y-auto max-h-56 space-y-1">
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
                              }}
                              className="px-3 py-2 hover:bg-black/20 transition-colors group relative border-l border-gray-700/50"
                              title="Copy URL"
                            >
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
                            </button>
                          </div>
                          <a
                            href={deploymentStore.deployedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-transparent text-white px-2 py-1 rounded-lg text-sm ring-1 ring-white-700 font-semibold transition-colors"
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
                            className="inline-flex items-center gap-2 bg-gradient-to-r to-blue-500 from-cyan-600 hover:to-blue-600 hover:from-cyan-600 text-white text-shadow-md text-shadow-discord px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg"
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
      </div>
    )
  }

  return <WebContainerPreview />
}
