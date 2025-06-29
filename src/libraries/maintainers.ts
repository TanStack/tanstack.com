import { Framework, getLibrary, Library } from '.'

export interface Maintainer {
  name: string
  avatar: string
  github: string
  isCoreMaintainer?: boolean
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
      'pacer',
      'react-charts',
    ],
    frameworkExpertise: ['react', 'solid'],
    specialties: ['Architecture', 'Core API', 'Documentation'],
    social: {
      twitter: 'https://x.com/tannerlinsley',
      bluesky: 'https://bsky.app/profile/tannerlinsley.com',
      website: 'https://tannerlinsley.com',
    },
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
      bluesky: 'https://bsky.app/profile/tkdodo.eu',
      website: 'https://tkdodo.eu',
    },
  },
  {
    name: 'Corbin Crutchley',
    isCoreMaintainer: true,
    avatar: 'https://github.com/crutchcorn.png',
    github: 'crutchcorn',
    creatorOf: ['form'],
    maintainerOf: ['store', 'config'],
    frameworkExpertise: ['react', 'solid', 'vue', 'angular'],
    specialties: ['Forms', 'Validation', 'State Management'],
    social: {
      twitter: 'https://x.com/crutchcorn',
      bluesky: 'https://bsky.app/profile/crutchcorn.dev',
      website: 'https://playfulprogramming.com/people/crutchcorn',
    },
  },
  {
    name: 'Manuel Schiller',
    isCoreMaintainer: true,
    avatar: 'https://github.com/schiller-manuel.png',
    github: 'schiller-manuel',
    maintainerOf: ['start', 'router'],
    frameworkExpertise: ['react'],
    specialties: ['Architecture', 'Core API', 'Documentation'],
    social: {
      twitter: 'https://x.com/schanuelmiller',
      bluesky: 'https://bsky.app/profile/manuelschiller.bsky.social',
    },
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
    social: {
      twitter: 'https://x.com/kevinvancott',
      bluesky: 'https://bsky.app/profile/kevinvancott.dev',
      website: 'https://kevinvancott.dev',
    },
  },
  {
    name: 'Sean Cassiere',
    isCoreMaintainer: true,
    avatar: 'https://github.com/seancassiere.png',
    github: 'seancassiere',
    maintainerOf: ['start', 'router'],
    frameworkExpertise: ['react'],
    specialties: ['Architecture', 'Core API', 'Documentation'],
    social: {
      twitter: 'https://x.com/seancassiere',
      bluesky: 'https://bsky.app/profile/seancassiere.com',
      website: 'https://seancassiere.com',
    },
  },
  {
    name: 'Chris Horobin',
    isCoreMaintainer: true,
    avatar: 'https://github.com/chorobin.png',
    github: 'chorobin',
    maintainerOf: ['start', 'router'],
    frameworkExpertise: ['react'],
    specialties: ['TypeScript'],
    social: {
      twitter: 'https://x.com/c_horobin',
      bluesky: 'https://bsky.app/profile/chorobin.bsky.social',
    },
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
    creatorOf: ['create-tsrouter-app'],
    frameworkExpertise: ['react'],
    specialties: ['Templates'],
  },
  {
    name: 'Kyle Mathews',
    isCoreMaintainer: true,
    avatar: 'https://github.com/KyleAMathews.png',
    github: 'KyleAMathews',
    creatorOf: ['db'],
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
  {
    name: 'Leonardo Montini',
    avatar: 'https://github.com/Balastrong.png',
    github: 'Balastrong',
    maintainerOf: ['form'],
    frameworkExpertise: ['react'],
    social: {
      website: 'https://leonardomontini.dev/',
      twitter: 'https://x.com/Balastrong',
      bluesky: 'https://bsky.app/profile/leonardomontini.dev',
    },
  },
  {
    name: 'Fredrik Höglund',
    avatar: 'https://github.com/ephem.png',
    github: 'ephem',
    maintainerOf: ['query'],
    frameworkExpertise: ['react'],
    specialties: ['Data Management', 'SSR', 'Hydration'],
    social: {
      bluesky: 'https://bsky.app/profile/ephem.dev',
      twitter: 'https://x.com/ephemjs',
      website: 'https://www.ephem.dev',
    },
  },
  {
    name: 'Aadit Olkar',
    avatar: 'https://github.com/aadito123.png',
    github: 'aadito123',
    maintainerOf: ['form'],
    frameworkExpertise: ['solid'],
    social: {
      twitter: 'https://x.com/swagdoctor19',
    },
  },
  {
    name: 'Luca Jakob',
    avatar: 'https://github.com/LeCarbonator.png',
    github: 'LeCarbonator',
    maintainerOf: ['form'],
    frameworkExpertise: ['react'],
  },
  {
    name: 'Jonghyeon Ko',
    avatar: 'https://github.com/manudeli.png',
    github: 'manudeli',
    maintainerOf: ['query'],
    frameworkExpertise: ['react'],
    specialties: ['TypeScript', 'Backport', 'Test'],
    social: {
      twitter: 'https://x.com/manudeli_',
      bluesky: 'https://bsky.app/profile/manudeli.bsky.social',
      website: 'https://www.linkedin.com/in/jonghyeonko',
    },
  },
  {
    name: 'Riccardo Perra',
    avatar:
      'https://cdn.bsky.app/img/avatar/plain/did:plc:gtnigsmgu7jyrc4tnkvn62qw/bafkreiceysbj4o6jrbbniudtwj3tcsns6rvwcxyjsqiaumeojurwbkki5a@jpeg',
    github: 'riccardoperra',
    maintainerOf: ['table'],
    frameworkExpertise: ['angular', 'solid'],
    specialties: [],
    social: {
      twitter: 'https://x.com/riccardoperra0',
      bluesky: 'https://bsky.app/profile/riccardoperra.bsky.social',
      website: 'https://riccardoperra.com',
    },
  },
  {
    name: 'Birk Skyum',
    avatar: 'https://github.com/birkskyum.png',
    github: 'birkskyum',
    maintainerOf: ['start'],
    contributorOf: ['pacer'],
    frameworkExpertise: ['solid'],
    specialties: [],
    social: {
      twitter: 'https://x.com/birkskyum',
      bluesky: 'https://bsky.app/profile/bskyum.bsky.social',
    },
  },
  {
    name: 'Arnoud de Vries',
    avatar: 'https://github.com/arnoud-dv.png',
    github: 'arnoud-dv',
    maintainerOf: ['query'],
    frameworkExpertise: ['angular', 'react'],
    specialties: [
      'Architecture',
      'Developer Experience',
      'TypeScript',
      'Reactivity',
    ],
    social: {
      twitter: 'https://x.com/Arnoud_dv',
      bluesky: 'https://bsky.app/profile/arnoud.dev',
      website: 'https://www.linkedin.com/in/arnouddv/',
    },
  },
  {
    name: 'Fülöp Kovács',
    avatar: 'https://github.com/fulopkovacs.png',
    github: 'fulopkovacs',
    maintainerOf: ['form'],
    frameworkExpertise: ['react'],
    social: {
      website: 'https://fulop.dev/',
      twitter: 'https://x.com/notacheetah',
      bluesky: 'https://bsky.app/profile/notacheetah.bsky.social',
    },
  },
  {
    name: 'Aryan Deora',
    avatar: 'https://github.com/ardeora.png',
    github: 'ardeora',
    maintainerOf: ['query'],
    frameworkExpertise: ['solid'],
    specialties: ['Dev Tools'],
    social: {
      twitter: 'https://x.com/aryan__deora',
      website: 'https://www.aryandeora.com/',
    },
  },
  {
    name: 'Mokshit Jain',
    avatar: 'https://github.com/Mokshit06.png',
    contributorOf: ['table'],
    frameworkExpertise: ['svelte', 'solid', 'vue'],
    github: 'Mokshit06',
    social: {
      twitter: 'https://x.com/mokshit06',
      website: 'https://mokshitjain.co',
    },
  },
  {
    name: 'Walker Lockard',
    github: 'walker-tx',
    avatar: 'https://github.com/walker-tx.png',
    contributorOf: ['table'],
    frameworkExpertise: ['svelte', 'react'],
    social: {
      twitter: 'https://x.com/walker_lockard',
      website: 'https://walker.dev',
    },
  },
  {
    name: 'Tom',
    github: 'tombuntus',
    avatar: 'https://github.com/tombuntus.png',
    contributorOf: ['table'],
    frameworkExpertise: ['react'],
    social: {},
  },
  {
    name: 'Damian Osipiuk',
    avatar: 'https://github.com/DamianOsipiuk.png',
    github: 'DamianOsipiuk',
    maintainerOf: ['query'],
    frameworkExpertise: ['vue'],
    specialties: [],
  },
  {
    name: 'Eliya Cohen',
    avatar: 'https://github.com/Newbie012.png',
    github: 'Newbie012',
    maintainerOf: ['query'],
    frameworkExpertise: [],
    specialties: ['eslint plugin'],
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
