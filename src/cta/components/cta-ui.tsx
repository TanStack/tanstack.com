import { AppSidebar } from './cta-sidebar'
import { AppHeader } from './header'
import { CTABackgroundAnimation } from './background-animation'
import FileNavigator from './file-navigator'
import StartupDialog from './startup-dialog'
import { CTAProvider } from './cta-provider'

export interface CreateTanstackAppUIProps {
  slots?: Partial<{
    header: React.ReactNode
    sidebar: React.ReactNode
    fileNavigator: React.ReactNode
    startupDialog: React.ReactNode
  }>
}

export const defaultSlots: CreateTanstackAppUIProps['slots'] = {
  header: <AppHeader />,
  sidebar: <AppSidebar />,
  fileNavigator: <FileNavigator />,
  startupDialog: <StartupDialog />,
}

export default function CreateTanstackAppUI(props: CreateTanstackAppUIProps) {
  const slots = Object.assign({}, defaultSlots, props.slots)

  return (
    <CTAProvider>
      <main className="min-w-[1280px]">
        <CTABackgroundAnimation />
        <div className="min-h-dvh p-2 sm:p-4 space-y-2 sm:space-y-4 @container">
          {slots.header}
          <div className="flex flex-row">
            <div className="w-1/3 @8xl:w-1/4 pr-2">
              {slots.sidebar}
            </div>
            <div className="w-2/3 @8xl:w-3/4 pl-2">
              {slots.fileNavigator}
            </div>
          </div>
        </div>
        {slots.startupDialog}
      </main>
    </CTAProvider>
  )
}
