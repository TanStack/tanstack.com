import BuilderRoot from '../components/cta-ui'

import { AppSidebar } from '../lib/cta-sidebar'
import { AppHeader } from '../lib/header'
import { CTABackgroundAnimation } from '../lib/background-animation'
import { Toaster } from '../lib/toaster'
import FileNavigator from '../lib/file-navigator'
import StartupDialog from '../lib/startup-dialog'
import { QueryProvider } from '../lib/query-provider'
import { CTAProvider } from '../lib/cta-provider'
import SelectedAddOns from '../lib/sidebar-items/add-ons'
import RunAddOns from '../lib/sidebar-items/run-add-ons'
import RunCreateApp from '../lib/sidebar-items/run-create-app'
import ProjectName from '../lib/sidebar-items/project-name'
import ModeSelector from '../lib/sidebar-items/mode-selector'
import TypescriptSwitch from '../lib/sidebar-items/typescript-switch'
import StarterDialog from '../lib/sidebar-items/starter'
import SidebarGroup from '../lib/sidebar-items/sidebar-group'

import { useApplicationMode, useManager, useReady } from '../store/project'

export {
  FileNavigator,
  AppSidebar,
  AppHeader,
  CTABackgroundAnimation,
  Toaster,
  StartupDialog,
  QueryProvider,
  CTAProvider,
  SelectedAddOns,
  RunAddOns,
  RunCreateApp,
  ProjectName,
  ModeSelector,
  TypescriptSwitch,
  StarterDialog,
  SidebarGroup,
  useApplicationMode,
  useManager,
  useReady,
}

export default BuilderRoot