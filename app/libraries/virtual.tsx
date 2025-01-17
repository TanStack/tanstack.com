import { VscPreview } from 'react-icons/vsc'
import { Library } from '.'
import { FaGithub, FaBolt, FaCogs } from 'react-icons/fa'
import { BiBookAlt } from 'react-icons/bi'
import { IoIosBody } from 'react-icons/io'
import { twMerge } from 'tailwind-merge'

const repo = 'tanstack/virtual'

const textStyles = 'text-violet-700 dark:text-violet-400'

export const virtualProject = {
  id: 'virtual',
  name: 'TanStack Virtual',
  cardStyles: `shadow-xl shadow-purple-700/20 dark:shadow-lg dark:shadow-purple-500/30 text-purple-500 border-2 border-transparent hover:border-current`,
  to: '/virtual',
  tagline: `Headless UI for Virtualizing Large Element Lists`,
  description: `Virtualize only the visible content for massive scrollable DOM nodes at 60FPS in TS/JS, React, Vue, Solid, Svelte, Lit & Angular while retaining 100% control over markup and styles.`,
  ogImage: 'https://github.com/tanstack/query/raw/main/media/header.png',
  badge: undefined,
  bgStyle: 'bg-purple-500',
  textStyle: 'text-purple-500',
  repo,
  latestBranch: 'main',
  latestVersion: 'v3',
  availableVersions: ['v3'],
  colorFrom: 'from-purple-500',
  colorTo: 'to-violet-600',
  textColor: 'text-purple-600',
  frameworks: ['react', 'solid', 'vue', 'svelte', 'lit', 'angular'],
  defaultDocs: 'introduction',
  scarfId: '32372eb1-91e0-48e7-8df1-4808a7be6b94',
  menu: [
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/virtual/latest/docs/framework/react/examples/dynamic',
    },
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/virtual/latest/docs/introduction',
    },
    {
      icon: <FaGithub />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Designed for zero design',
      icon: (
        <div className="text-center overflow-hidden">
          <IoIosBody className="text-purple-400" />
        </div>
      ),
      description: (
        <div>
          Headless Virtualization means you're always in control of your{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            markup, styles and components
          </span>
          . Go design and implement the most beautiful UI you can dream up and
          let us take care of the hard parts.
        </div>
      ),
    },
    {
      title: 'Big Power, Small Package',
      icon: <FaBolt className="text-purple-500" />,
      description: (
        <div>
          Don't be fooled by the small bundle size. TanStack Virtual uses every
          byte to deliver powerful performance. After all,{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            60FPS is table stakes
          </span>{' '}
          these days and we refuse to sacrifice anything for that 🧈-y smooth
          UX.
        </div>
      ),
    },
    {
      title: 'Maximum Composability',
      icon: <FaCogs className="text-purple-600" />,
      description: (
        <div>
          With a single function/hook, you'll get limitless virtualization for{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            vertical, horizontal, and grid-style{' '}
          </span>
          layouts. The API is tiny (literally 1 function), but its composability
          is not.
        </div>
      ),
    },
  ],
} satisfies Library
