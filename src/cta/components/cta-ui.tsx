import { BuilderSidebar } from './cta-sidebar'
import { BuilderHeader } from './header'
import { CTABackgroundAnimation } from './background-animation'
import FileNavigator from './file-navigator'
import StartupDialog from './startup-dialog'
import { CTAProvider } from './cta-provider'
import { BuilderPreview } from './preview'
import WebContainerProvider from './web-container-provider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

export default function BuilderRoot() {
  return (
    <CTAProvider>
      <WebContainerProvider>
        <main className="w-screen min-w-[1280px]">
          <CTABackgroundAnimation />
          <div className="h-dvh p-2 sm:p-4 flex flex-col gap-2 sm:gap-4 @container">
            <BuilderHeader />
            <div className="flex flex-row flex-1 min-h-0">
              <div className="w-1/3 @8xl:w-1/4 pr-2 flex flex-col h-full">
                <BuilderSidebar />
              </div>
              <div className="w-2/3 @8xl:w-3/4 pl-2">
                <Tabs defaultValue="preview" className="h-full">
                  <TabsList>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
                  </TabsList>
                  <TabsContent value="files">
                    <FileNavigator />
                  </TabsContent>
                  <TabsContent value="preview">
                    <BuilderPreview />
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
