import angularLogo from '../images/angular-logo.svg'
import jsLogo from '../images/js-logo.svg'
import litLogo from '../images/lit-logo.svg'
import preactLogo from '../images/preact-logo.svg'
import qwikLogo from '../images/qwik-logo.svg'
import reactLogo from '../images/react-logo.svg'
import solidLogo from '../images/solid-logo.svg'
import svelteLogo from '../images/svelte-logo.svg'
import vueLogo from '../images/vue-logo.svg'
import { configProject } from './config'
import { dbProject } from './db'
import { formProject } from './form'
import { pacerProject } from './pacer'
import { queryProject } from './query'
import { rangerProject } from './ranger'
import { routerProject } from './router'
import { startProject } from './start'
import { storeProject } from './store'
import { tableProject } from './table'
import { virtualProject } from './virtual'

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
    | 'react-charts'
  name: string
  cardStyles: string
  to: string
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
}

export type LibraryMenuItem = {
  icon: React.ReactNode
  label: React.ReactNode
  to: string
}

export const libraries = [
  startProject,
  routerProject,
  queryProject,
  tableProject,
  formProject,
  virtualProject,
  pacerProject,
  storeProject,
  rangerProject,
  dbProject,
  configProject,
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
  other: [configProject],
}

export const librariesGroupNamesMap = {
  app: 'Application Building',
  state: 'Data and State Management',
  headlessUI: 'Headless UI',
  other: 'Other',
}

export function getLibrary(id: string) {
  const library = libraries.find((d) => d.id === id)

  if (!library) {
    throw new Error(`Library with id "${id}" not found`)
  }

  return library as Library
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
