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
import { aiProject } from './ai'
import { devtoolsProject } from './devtools'
import {
  type Framework,
  type Library,
  type LibraryId,
  type LibraryMenuItem,
  frameworkOptions,
} from './types'

// Re-export types for backward compatibility
export type { Framework, Library, LibraryId, LibraryMenuItem }
export { frameworkOptions }

export const libraries = [
  startProject,
  routerProject,
  queryProject,
  tableProject,
  formProject,
  dbProject,
  aiProject,
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
  },
  {
    id: 'create-tsrouter-app',
    name: 'Create TS Router App',
    repo: 'tanstack/create-tsrouter-app',
  },
]

export const librariesByGroup = {
  state: [
    startProject,
    routerProject,
    queryProject,
    dbProject,
    storeProject,
    aiProject,
  ],
  headlessUI: [tableProject, formProject],
  performance: [virtualProject, pacerProject],
  tooling: [devtoolsProject, configProject],
}

export const librariesGroupNamesMap = {
  state: 'Data and State Management',
  headlessUI: 'Headless UI',
  performance: 'Performance',
  tooling: 'Tooling',
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
