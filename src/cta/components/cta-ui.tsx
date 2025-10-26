import { useMemo } from 'react'
import { BuilderSidebar } from './cta-sidebar'
import { BuilderHeader } from './header'
import { CTABackgroundAnimation } from './background-animation'
import FileNavigator from './file-navigator'
import StartupDialog from './startup-dialog'
import { CTAProvider } from './cta-provider'
import { BuilderPreview } from './builder-preview'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { useDryRun } from '../store/project'
import WebContainerProvider from '../sandbox/web-container-provider'

export default function BuilderRoot() {
  const dryRun = useDryRun()

  // Convert dryRun.files (Record<string, string>) to projectFiles array
  const projectFiles = useMemo(() => {
    if (!dryRun?.files) return []

    return Object.entries(dryRun.files).map(([path, content]) => {
      const normalizedPath = path.startsWith('./') ? path : `./${path}`
      return {
        path: normalizedPath,
        content,
      }
    })
  }, [dryRun.files])

  // Detect Firefox - disable ALS shim for Firefox as it may cause issues
  const isFirefox =
    typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox')
  console.log(
    `🌐 Browser detected - Firefox: ${isFirefox}, ALS Shim: ${!isFirefox}`
  )

  return (
    <CTAProvider>
      <WebContainerProvider
        projectFiles={projectFiles}
        shouldShimALS={!isFirefox}
      >
        <main className="w-full max-w-full overflow-x-hidden">
          <CTABackgroundAnimation />
          <div className="h-dvh p-2 sm:p-4 flex flex-col gap-2 sm:gap-4 @container">
            <BuilderHeader />
            <div className="flex flex-row flex-1 min-h-0">
              <div className="w-1/3 @8xl:w-1/4 pr-2 flex flex-col h-full">
                <BuilderSidebar />
              </div>
              <div className="w-2/3 @8xl:w-3/4 pl-2">
                <Tabs
                  defaultValue={isFirefox ? 'files' : 'preview'}
                  className="h-full"
                >
                  <TabsList>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
                  </TabsList>
                  <TabsContent value="files">
                    <FileNavigator />
                  </TabsContent>
                  <TabsContent value="preview">
                    {isFirefox ? (
                      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-2xl w-full mx-4 border-2 border-orange-500">
                          <div className="text-center">
                            <div className="text-6xl mb-4">🦊</div>
                            <h2 className="text-2xl font-bold mb-4">
                              Firefox Preview Not Available
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                              Unfortunately, WebContainer preview is not
                              currently supported in Firefox due to browser
                              limitations.
                            </p>
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left mb-6">
                              <div className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                                What you can do:
                              </div>
                              <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-2 list-disc list-inside">
                                <li>
                                  Use the <strong>Files</strong> tab to view and
                                  edit your generated code
                                </li>
                                <li>
                                  Download or export your project to run it
                                  locally
                                </li>
                                <li>
                                  Use Chrome, Edge, or another Chromium-based
                                  browser for preview functionality
                                </li>
                              </ul>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              This is a known limitation of WebContainer
                              technology in Firefox.
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <BuilderPreview />
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
          <StartupDialog />
        </main>
      </WebContainerProvider>
    </CTAProvider>
  )
}
