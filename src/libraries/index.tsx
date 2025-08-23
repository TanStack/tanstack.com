import reactLogo from '../images/react-logo.svg'
import preactLogo from '../images/preact-logo.svg'
import solidLogo from '../images/solid-logo.svg'
import vueLogo from '../images/vue-logo.svg'
import angularLogo from '../images/angular-logo.svg'
import svelteLogo from '../images/svelte-logo.svg'
import litLogo from '../images/lit-logo.svg'
import qwikLogo from '../images/qwik-logo.svg'
import jsLogo from '../images/js-logo.svg'
import { queryProject } from './query'
import { formProject } from './form'
import { configProject } from './config'
import { routerProject } from './router'
import { startProject } from './start'
import { tableProject } from './table'
import { virtualProject } from './virtual'
import { rangerProject } from './ranger'
import { storeProject } from './store'
import { pacerProject } from './pacer'
import { dbProject } from './db'
import { devtoolsProject } from './devtools'

export const frameworkOptions = [
  { label: 'React', value: 'react', logo: reactLogo, color: 'bg-blue-500' },
  { label: 'Preact', value: 'preact', logo: preactLogo, color: 'bg-blue-400' },
  { label: 'Vue', value: 'vue', logo: vueLogo, color: 'bg-green-500' },
  {
    label: 'Angular',
    value: 'angular',
    logo: angularLogo,
    color: 'bg-red-500',
  },
  { label: 'Solid', value: 'solid', logo: solidLogo, color: 'bg-blue-600' },
  { label: 'Lit', value: 'lit', logo: litLogo, color: 'bg-orange-500' },
  {
    label: 'Svelte',
    value: 'svelte',
    logo: svelteLogo,
    color: 'bg-orange-600',
  },
  { label: 'Qwik', value: 'qwik', logo: qwikLogo, color: 'bg-purple-500' },
  { label: 'Vanilla', value: 'vanilla', logo: jsLogo, color: 'bg-yellow-500' },
] as const

export type Framework = (typeof frameworkOptions)[number]['value']

export type Library = {
  id:
    | 'start'
    | 'router'
    | 'query'
    | 'table'
    | 'form'
    | 'virtual'
    | 'ranger'
    | 'store'
    | 'pacer'
    | 'db'
    | 'config'
    | 'devtools'
    | 'react-charts'
    | 'create-tsrouter-app'
  name: string
  cardStyles: string
  to?: string
  tagline: string
  description: string
  ogImage?: string
  bgStyle: string
  textStyle: string
  badge?: 'new' | 'soon' | 'alpha' | 'beta' | 'fresh'
  repo: string
  latestBranch: string
  latestVersion: string
  availableVersions: string[]
  colorFrom: string
  colorTo: string
  textColor: string
  frameworks: Framework[]
  scarfId?: string
  defaultDocs?: string
  handleRedirects?: (href: string) => void
  hideCodesandboxUrl?: true
  hideStackblitzUrl?: true
  showVercelUrl?: boolean
  showNetlifyUrl?: boolean
  menu: LibraryMenuItem[]
  featureHighlights?: {
    title: string
    icon: React.ReactNode
    description: React.ReactNode
  }[]
  docsRoot?: string
  embedEditor?: 'codesandbox' | 'stackblitz'
  visible?: boolean
}

export type LibraryMenuItem = {
  icon: React.ReactNode
  label: React.ReactNode
  to: string
}

export type LibraryId = Library['id']

export const libraries = [
  startProject,
  routerProject,
  queryProject,
  tableProject,
  formProject,
  dbProject,
  virtualProject,
  pacerProject,
  storeProject,
  rangerProject,
  configProject,
  devtoolsProject,
  {
    id: 'react-charts',
    name: 'React Charts',
    repo: 'tanstack/react-charts',
  } as Library,
  {
    id: 'create-tsrouter-app',
    name: 'Create TS Router App',
    repo: 'tanstack/create-tsrouter-app',
  } as Library,
] satisfies Library[]

export const librariesByGroup = {
  state: [
    startProject,
    routerProject,
    queryProject,
    dbProject,
    storeProject,
    pacerProject,
  ],
  headlessUI: [tableProject, formProject, virtualProject, rangerProject],
  other: [devtoolsProject, configProject],
}

export const librariesGroupNamesMap = {
  state: 'Data and State Management',
  headlessUI: 'Headless UI',
  other: 'Other',
}

export function getLibrary(id: LibraryId): Library {
  const library = libraries.find((d) => d.id === id)!

  if (!library) {
    throw new Error(`Library with id "${id}" not found!`)
  }

  return library
}

export function findLibrary(id: string): Library | undefined {
  try {
    return getLibrary(id as any)
  } catch (error) {
    return undefined
  }
}

export function getFrameworkOptions(frameworkStrs: Framework[]) {
  if (!frameworkOptions) {
    throw new Error('frameworkOptions is not defined')
  }
  return frameworkOptions.filter((d) => frameworkStrs.includes(d.value))
}

export function getBranch(library: Library, argVersion?: string) {
  if (!library) {
    throw new Error('Library is required')
  }

  const version = argVersion || library.latestVersion

  const resolvedVersion = ['latest', library.latestVersion].includes(version)
    ? library.latestBranch
    : version

  if (!resolvedVersion) {
    throw new Error(`Could not resolve version for ${library.name}`)
  }

  return resolvedVersion
}
