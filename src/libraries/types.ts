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

export type LibraryId =
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

// Base library type - used for navigation, docs, and most UI
export type LibrarySlim = {
  id: LibraryId
  name: string
  to?: string
  tagline: string
  description?: string
  cardStyles: string
  bgStyle: string
  borderStyle: string
  textStyle: string
  textColor?: string
  colorFrom: string
  colorTo: string
  bgRadial?: string
  badge?: 'new' | 'soon' | 'alpha' | 'beta' | 'fresh' | 'RC'
  repo: string
  frameworks: Framework[]
  latestVersion: string
  latestBranch?: string
  availableVersions: string[]
  scarfId?: string
  defaultDocs?: string
  docsRoot?: string
  ogImage?: string
  hideCodesandboxUrl?: true
  hideStackblitzUrl?: true
  showVercelUrl?: boolean
  showNetlifyUrl?: boolean
  showCloudflareUrl?: boolean
  embedEditor?: 'codesandbox' | 'stackblitz'
  legacyPackages?: string[]
  installPath?: string
  corePackageName?: string
  handleRedirects?: (href: string) => void
  visible?: boolean
}

// Extended library type - adds React node content for landing pages
// This is code-split with the library landing pages
export type Library = LibrarySlim & {
  featureHighlights?: {
    title: string
    icon: React.ReactNode
    description: React.ReactNode
  }[]
  testimonials?: Testimonial[]
}

export type Testimonial = {
  quote: string
  author: string
  role: string
  company: string
  avatar?: string
}
