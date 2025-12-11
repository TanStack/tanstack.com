import * as React from 'react'

export type Framework =
  | 'angular'
  | 'lit'
  | 'preact'
  | 'qwik'
  | 'react'
  | 'solid'
  | 'svelte'
  | 'vanilla'
  | 'vue'

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
    | 'ai'
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
  // Legacy npm packages (non-@tanstack scope) to include in stats
  legacyPackages?: string[]
  installPath?: string
  corePackageName?: string
}

export type LibraryMenuItem = {
  icon: React.ReactNode
  label: React.ReactNode
  to: string
}

export type LibraryId = Library['id']
