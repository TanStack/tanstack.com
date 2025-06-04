import { Framework, getLibrary, Library } from '.'

export interface Maintainer {
  name: string
  avatar: string
  github: string
  isCoreMaintainer: boolean
  creatorOf?: Library['id'][]
  maintainerOf?: Library['id'][] // inherits from creatorOf
  contributorOf?: Library['id'][] // inherits from maintainerOf
  consultantOf?: Library['id'][] // inherits from maintainerOf
  frameworkExpertise?: Framework[]
  specialties?: string[]
  social?: {
    twitter?: string
    bluesky?: string
    website?: string
  }
}

// order matters
export const allMaintainers: Maintainer[] = [
  {
    name: 'Tanner Linsley',
    isCoreMaintainer: true,
    avatar: 'https://github.com/tannerlinsley.png',
    github: 'tannerlinsley',
    creatorOf: [
      'start',
      'router',
      'query',
      'table',
      'form',
      'virtual',
      'ranger',
      'store',
      'react-charts',
    ],
    frameworkExpertise: ['react', 'solid'],
    specialties: ['Architecture', 'Core API', 'Documentation'],
  },
  {
    name: 'Dominik Dorfmeister',
    isCoreMaintainer: true,
    avatar: 'https://github.com/tkdodo.png',
    github: 'tkdodo',
    maintainerOf: ['query'],
    contributorOf: ['router'],
    frameworkExpertise: ['react'],
    specialties: ['Core API', 'TypeScript', 'Documentation'],
    social: {
      bluesky: '@tkdodo.eu',
      website: 'https://tkdodo.eu',
    },
  },
  {
    name: 'Corbin Crutchley',
    isCoreMaintainer: true,
    avatar: 'https://github.com/crutchcorn.png',
    github: 'crutchcorn',
    creatorOf: ['form'],
    maintainerOf: ['store'],
    frameworkExpertise: ['react', 'solid', 'vue', 'angular'],
    specialties: ['Forms', 'Validation', 'State Management'],
  },
  {
    name: 'Manual Schiller',
    isCoreMaintainer: true,
    avatar: 'https://github.com/schiller-manuel.png',
    github: 'schiller-manuel',
    maintainerOf: ['start', 'router'],
    frameworkExpertise: ['react'],
    specialties: [],
  },
  {
    name: 'Kevin Van Cott',
    isCoreMaintainer: true,
    avatar: 'https://github.com/kevinvandy.png',
    github: 'kevinvandy',
    creatorOf: ['pacer'],
    maintainerOf: ['table'],
    contributorOf: ['virtual'],
    consultantOf: ['query'],
    frameworkExpertise: ['react', 'solid', 'svelte'],
    specialties: ['Tables', 'Data Grids', 'Dashboards'],
  },
  {
    name: 'Sean Cassiere',
    isCoreMaintainer: true,
    avatar: 'https://github.com/seancassiere.png',
    github: 'seancassiere',
    maintainerOf: ['start', 'router'],
    frameworkExpertise: ['react'],
    specialties: [],
  },
  {
    name: 'Chris Horobin',
    isCoreMaintainer: true,
    avatar: 'https://github.com/chorobin.png',
    github: 'chorobin',
    maintainerOf: ['router'],
    frameworkExpertise: ['react'],
    specialties: ['TypeScript'],
  },
  {
    name: 'Damian Pieczynski',
    isCoreMaintainer: true,
    avatar: 'https://github.com/piecyk.png',
    github: 'piecyk',
    maintainerOf: ['virtual'],
    frameworkExpertise: ['react'],
    specialties: ['Virtualization', 'Performance'],
  },
  {
    name: 'Jack Herrington',
    isCoreMaintainer: true,
    avatar: 'https://github.com/jherr.png',
    github: 'jherr',
    creatorOf: ['create-ts-router-app'],
    frameworkExpertise: ['react'],
    specialties: ['Templates'],
  },
  {
    name: 'Kyle Mathews',
    isCoreMaintainer: true,
    avatar: 'https://github.com/KyleAMathews.png',
    github: 'KyleAMathews',
    creatorOf: ['create-ts-router-app'],
    frameworkExpertise: ['react'],
    specialties: ['Sync Engines'],
  },
  {
    name: 'Lachlan Collins',
    isCoreMaintainer: true,
    avatar: 'https://github.com/lachlancollins.png',
    github: 'lachlancollins',
    maintainerOf: ['config', 'query'],
    frameworkExpertise: ['react', 'svelte'],
    specialties: ['Architecture'],
  },
]

export const coreMaintainers = allMaintainers.filter(
  (maintainer) => maintainer.isCoreMaintainer
)

export function getLibraryCreators(libraryId: string): Maintainer[] {
  return allMaintainers.filter((maintainer) =>
    maintainer.creatorOf?.includes(libraryId as Library['id'])
  )
}

export function getLibraryMaintainers(
  libraryId: string,
  includeCreators = true
): Maintainer[] {
  const creators = getLibraryCreators(libraryId)
  const maintainers = allMaintainers.filter((maintainer) =>
    maintainer.maintainerOf?.includes(libraryId as Library['id'])
  )

  // Use Set to dedupe while preserving order
  return includeCreators
    ? [...new Set([...creators, ...maintainers])]
    : maintainers
}

export function getLibraryContributors(
  libraryId: string,
  includeMaintainers = true
): Maintainer[] {
  const maintainers = getLibraryMaintainers(libraryId)
  const contributors = allMaintainers.filter((maintainer) =>
    maintainer.contributorOf?.includes(libraryId as Library['id'])
  )

  return includeMaintainers
    ? [...new Set([...maintainers, ...contributors])]
    : contributors
}

export function getLibraryConsultants(
  libraryId: string,
  includeMaintainers = true
): Maintainer[] {
  const maintainers = getLibraryMaintainers(libraryId)
  const consultants = allMaintainers.filter((maintainer) =>
    maintainer.consultantOf?.includes(libraryId as Library['id'])
  )

  return includeMaintainers
    ? [...new Set([...maintainers, ...consultants])]
    : consultants
}

export function getPersonsCreatorOf(person: Maintainer): Library[] {
  return person.creatorOf?.map((libraryId) => getLibrary(libraryId)) || []
}

export function getPersonsMaintainerOf(
  person: Maintainer,
  includeCreatorOf = true
): Library[] {
  const creatorOf = getPersonsCreatorOf(person)
  const maintainerOf =
    person.maintainerOf?.map((libraryId) => getLibrary(libraryId)) || []

  return includeCreatorOf
    ? [...new Set([...creatorOf, ...maintainerOf])]
    : maintainerOf
}

export function getPersonsContributorOf(
  person: Maintainer,
  includeMaintainers = true
): Library[] {
  const maintainers = getPersonsMaintainerOf(person)
  const contributors =
    person.contributorOf?.map((libraryId) => getLibrary(libraryId)) || []

  return includeMaintainers
    ? [...new Set([...maintainers, ...contributors])]
    : contributors
}

export function getPersonsConsultantOf(
  person: Maintainer,
  includeMaintainers = true
): Library[] {
  const maintainers = getPersonsMaintainerOf(person)
  const consultants =
    person.consultantOf?.map((libraryId) => getLibrary(libraryId)) || []

  return includeMaintainers
    ? [...new Set([...maintainers, ...consultants])]
    : consultants
}

export function getIsCreatorOfLibrary(person: Maintainer, libraryId: string) {
  return person.creatorOf?.includes(libraryId as Library['id'])
}

export function getIsMaintainerOfLibrary(
  person: Maintainer,
  libraryId: string
) {
  return person.maintainerOf?.includes(libraryId as Library['id'])
}

export function getIsContributorOfLibrary(
  person: Maintainer,
  libraryId: string
) {
  return person.contributorOf?.includes(libraryId as Library['id'])
}

export function getIsConsultantOfLibrary(
  person: Maintainer,
  libraryId: string
) {
  return person.consultantOf?.includes(libraryId as Library['id'])
}

export function getRoleInLibrary(person: Maintainer, libraryId: string) {
  if (getIsCreatorOfLibrary(person, libraryId)) return 'Creator'
  if (getIsMaintainerOfLibrary(person, libraryId)) return 'Maintainer'
  if (getIsContributorOfLibrary(person, libraryId)) return 'Contributor'
  if (getIsConsultantOfLibrary(person, libraryId)) return 'Consultant'
  return 'Contributor'
}
