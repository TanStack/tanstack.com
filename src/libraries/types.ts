import * as React from 'react'
import reactLogo from '../images/react-logo.svg'
import vueLogo from '../images/vue-logo.svg'
import angularLogo from '../images/angular-logo.svg'
import svelteLogo from '../images/svelte-logo.svg'
import solidLogo from '../images/solid-logo.svg'
import jsLogo from '../images/js-logo.svg'

export const frameworkOptions = [
  { label: 'React', value: 'react', logo: reactLogo, color: 'bg-blue-500' },
  { label: 'Vue', value: 'vue', logo: vueLogo, color: 'bg-green-500' },
  { label: 'Angular', value: 'angular', logo: angularLogo, color: 'bg-red-500' },
  { label: 'Svelte', value: 'svelte', logo: svelteLogo, color: 'bg-orange-500' },
  { label: 'Solid', value: 'solid', logo: solidLogo, color: 'bg-blue-600' },
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
  badge?: 'new' | 'soon' | 'alpha' | 'beta' | 'fresh' | 'RC'
  repo: string
  latestBranch: string
  latestVersion: string
  availableVersions: string[]
  bgRadial: string
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
  showCloudflareUrl?: boolean
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

