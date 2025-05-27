import { VscPreview, VscWand } from 'react-icons/vsc'
import { Library } from '.'
import { FaGithub, FaBolt, FaCogs } from 'react-icons/fa'
import { BiBookAlt } from 'react-icons/bi'
import { twMerge } from 'tailwind-merge'

const repo = 'tanstack/store'

const textStyles = 'text-twine-600 dark:text-twine-500'

export const storeProject = {
  id: 'store',
  name: 'TanStack Store',
  cardStyles: `shadow-xl shadow-twine-700/20 dark:shadow-lg dark:shadow-twine-500/20 text-twine-500 dark:text-twine-400 border-2 border-transparent hover:border-current`,
  to: '/store',
  tagline: `Framework agnostic data store with reactive framework adapters`,
  description: `The immutable-reactive data store that powers the core of TanStack libraries and their framework adapters.`,
  ogImage: 'https://github.com/tanstack/store/raw/main/media/repo-header.png',
  badge: 'alpha',
  bgStyle: 'bg-twine-700',
  textStyle: 'text-twine-500',
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  colorFrom: 'from-twine-500',
  colorTo: 'to-twine-700',
  textColor: 'text-twine-700',
  frameworks: ['react', 'solid', 'svelte', 'vue', 'angular'],
  scarfId: '302d0fef-cb3f-43c6-b45c-f055b9745edb',
  defaultDocs: 'overview',
  menu: [
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/store/latest/docs',
    },
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/store/latest/docs/framework/react/examples/simple',
    },
    {
      icon: <FaGithub />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Battle-Tested',
      icon: <VscWand className={twMerge(textStyles)} />,
      description: (
        <div>
          TanStack Store is widely adopted across the TanStack ecosystem,
          powering libraries like TanStack Form, TanStack Router, and more. It
          has been{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            battle-tested in production environments, ensuring reliability and
            performance
          </span>{' '}
          for developers.
        </div>
      ),
    },
    {
      title: 'Tiny Bundle Size',
      icon: <VscWand className={twMerge(textStyles)} />,
      description: (
        <div>
          Designed with a focus on performance and efficiency, boasting a{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            tiny bundle size
          </span>{' '}
          that ensures fast loading times and minimal impact on application
          performance. This makes it an ideal choice for developers looking to
          optimize their applications.
        </div>
      ),
    },
    {
      title: 'Framework Agnostic',
      icon: <VscWand className={twMerge(textStyles)} />,
      description: (
        <div>
          TanStack Store is{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            framework agnostic
          </span>
          , with adapters available for popular frameworks like React, Vue,
          Angular, Solid, and Svelte. This flexibility allows developers to use
          the store in their preferred framework without being locked into a
          specific ecosystem.
        </div>
      ),
    },
  ],
} satisfies Library
