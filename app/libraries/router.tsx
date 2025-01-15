import { FaGithub } from 'react-icons/fa'
import { Library } from '.'
import { VscPreview } from 'react-icons/vsc'
import { BiBookAlt } from 'react-icons/bi'

const repo = 'tanstack/router'

export const routerProject = {
  id: 'router',
  name: 'TanStack Router',
  cardStyles: `shadow-xl shadow-emerald-700/20 dark:shadow-lg dark:shadow-emerald-500/30 text-emerald-500 dark:text-emerald-400 border-2 border-transparent hover:border-current`,
  to: '/router',
  tagline: `Type-safe Routing for React applications.`,
  description: `A powerful React router for client-side and full-stack react applications. Fully type-safe APIs, first-class search-params for managing state in the URL and seamless integration with the existing React ecosystem.`,
  ogImage: 'https://github.com/tanstack/router/raw/main/media/header.png',
  bgStyle: 'bg-emerald-500',
  textStyle: 'text-emerald-500',
  badge: 'new',
  repo,
  latestBranch: 'main',
  latestVersion: 'v1',
  availableVersions: ['v1'],
  colorFrom: 'from-lime-500',
  colorTo: 'to-emerald-500',
  textColor: 'text-emerald-500',
  frameworks: ['react'],
  scarfId: '3d14fff2-f326-4929-b5e1-6ecf953d24f4',
  defaultDocs: 'framework/react/overview',
  hideCodesandboxUrl: true,
  showVercelUrl: false,
  showNetlifyUrl: true,
  menu: [
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/router/latest/docs/framework/react/examples/kitchen-sink-file-based',
    },
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/router/latest/docs/framework/react/overview',
    },
    {
      icon: <FaGithub />,
      label: 'GitHub',
      to: `https://github.com/${repo}`,
    },
  ],
} satisfies Library
