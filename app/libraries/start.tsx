import { FaBook, FaDiscord, FaGithub } from 'react-icons/fa'
import { Library } from '.'
import { VscPreview } from 'react-icons/vsc'
import { ImBook } from 'react-icons/im'
import { BiBookAlt } from 'react-icons/bi'

const repo = 'tanstack/start'

export const startProject = {
  id: 'start',
  name: 'TanStack Start',
  cardStyles: `shadow-xl shadow-cyan-500/20 dark:shadow-lg dark:shadow-cyan-500/30 text-cyan-500 dark:text-white-400 border-2 border-transparent hover:border-current`,
  to: '/start',
  tagline: `Full-stack React Framework powered by TanStack Router`,
  description: `Full-document SSR, Streaming, Server Functions, bundling and more, powered by TanStack Router, Vinxi, and Nitro and ready to deploy to your favorite hosting provider.`,
  bgStyle: 'bg-cyan-500',
  textStyle: 'text-cyan-500',
  badge: 'beta',
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  colorFrom: 'from-cyan-500',
  colorTo: 'to-cyan-600',
  textColor: 'text-cyan-600',
  frameworks: ['react'],
  scarfId: 'b6e2134f-e805-401d-95c3-2a7765d49a3d',
  menu: [
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/router/latest/docs',
    },
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/router/latest/docs/framework/react/examples/start-basic',
    },
    {
      icon: <FaGithub />,
      label: 'GitHub',
      to: `https://github.com/${repo}`,
    },
  ],
} satisfies Library
