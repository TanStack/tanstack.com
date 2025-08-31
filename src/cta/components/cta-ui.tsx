import { AppSidebar } from './cta-sidebar'
import { AppHeader } from './header'
import { CTABackgroundAnimation } from './background-animation'
import FileNavigator from './file-navigator'
import StartupDialog from './startup-dialog'
import { CTAProvider } from './cta-provider'
import { BuilderPreview } from './preview'
import WebContainerProvider from './web-container-provider'

export default function BuilderRoot() {
  return (
    <CTAProvider>
      <WebContainerProvider>
        <main className="min-w-[1280px]">
          <CTABackgroundAnimation />
          <div className="min-h-dvh p-2 sm:p-4 space-y-2 sm:space-y-4 @container">
            <AppHeader />
            <div className="flex flex-row">
              <div className="w-1/3 @8xl:w-1/4 pr-2">
                <AppSidebar />
              </div>
              <div className="w-2/3 @8xl:w-3/4 pl-2">
                <FileNavigator />
              </div>
            </div>
            <BuilderPreview />
          </div>
          <StartupDialog />
        </main>
      </WebContainerProvider>
    </CTAProvider>
  )
}
