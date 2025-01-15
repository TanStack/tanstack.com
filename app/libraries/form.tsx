import { VscPreview } from 'react-icons/vsc'
import { Library } from '.'
import { FaGithub } from 'react-icons/fa'
import { BiBookAlt } from 'react-icons/bi'

const repo = 'tanstack/form'

export const formProject = {
  id: 'form',
  name: 'TanStack Form',
  cardStyles: `shadow-xl shadow-yellow-700/20 dark:shadow-lg dark:shadow-yellow-500/30 text-yellow-500 border-2 border-transparent hover:border-current`,
  to: '/form',
  tagline: `Headless UI for building performant and type-safe forms`,
  description: `Headless, performant, and type-safe form state management for TS/JS, React, Vue, Angular, Solid and Lit`,
  ogImage: 'https://github.com/tanstack/form/raw/main/media/repo-header.png',
  badge: 'new',
  bgStyle: 'bg-yellow-500',
  textStyle: 'text-yellow-500',
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  colorFrom: 'from-yellow-500',
  colorTo: 'to-yellow-600',
  textColor: 'text-yellow-600',
  frameworks: ['react', 'vue', 'angular', 'solid', 'lit'],
  scarfId: '72ec4452-5d77-427c-b44a-57515d2d83aa',
  menu: [
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/form/latest/docs/framework/react/examples/simple',
    },
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/form/latest/docs',
    },
    {
      icon: <FaGithub />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
} satisfies Library
