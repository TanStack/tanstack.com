import { VscPreview } from 'react-icons/vsc'
import { Library } from '.'
import { FaGithub } from 'react-icons/fa'
import { BiBookAlt } from 'react-icons/bi'
const repo = 'tanstack/ranger'

export const rangerProject = {
  id: 'ranger',
  name: 'TanStack Ranger',
  cardStyles: `shadow-xl shadow-pink-700/20 dark:shadow-lg dark:shadow-pink-500/30 text-pink-500 border-2 border-transparent hover:border-current`,
  to: '/ranger',
  tagline: `Headless range and multi-range slider utilities.`,
  description: `Headless, lightweight, and extensible primitives for building range and multi-range sliders.`,
  ogImage: 'https://github.com/tanstack/ranger/raw/main/media/headerv1.png',
  badge: undefined,
  bgStyle: 'bg-pink-500',
  textStyle: 'text-pink-500',
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  colorFrom: 'from-pink-400',
  colorTo: 'to-pink-500',
  textColor: 'text-pink-500',
  frameworks: ['react'],
  scarfId: 'dd278e06-bb3f-420c-85c6-6e42d14d8f61',
  menu: [
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/ranger/latest/docs/framework/react/examples/basic',
    },
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/ranger/latest/docs/overview',
    },
    {
      icon: <FaGithub />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
} satisfies Library
