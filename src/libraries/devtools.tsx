import { FaGithub, FaBolt, FaCogs } from 'react-icons/fa'
import { Library } from '.'
import { BiBookAlt } from 'react-icons/bi'
import { VscWand } from 'react-icons/vsc'
import { twMerge } from 'tailwind-merge'

const repo = 'tanstack/devtools'

const textStyles = 'text-gray-700 dark:text-gray-500'

export const devtoolsProject = {
  id: 'devtools',
  name: 'TanStack Devtools',
  cardStyles: `shadow-xl shadow-slate-700/20 dark:shadow-lg dark:shadow-slate-500/30 text-slate-400 border-2 border-transparent hover:border-current`,
  to: '/devtools',
  tagline: `Centralized devtools panel for TanStack libraries and other custom devtools`,
  description: `A unified devtools panel that houses all TanStack devtools and allows you to create and integrate your own custom devtools.`,
  ogImage:
    'https://github.com/tanstack/devtools/raw/main/media/repo-header.png',
  badge: 'alpha',
  bgStyle: 'bg-slate-400/40 dark:bg-slate-400/30',
  bgStyleAccent: 'bg-slate-400',
  bgStyleMuted: 'bg-slate-400/20',
  bgStyleAccentHover: 'hover:bg-slate-400/30 dark:hover:bg-slate-400/40',
  textStyle: 'text-slate-400',
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  bgRadial: 'from-slate-400 via-slate-600/50 to-transparent',
  colorFrom: 'from-slate-400',
  colorTo: 'to-slate-600',
  textColor: 'text-slate-600',
  frameworks: ['react', 'solid', 'vanilla'],
  menu: [
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/devtools/latest/docs',
    },
    {
      icon: <FaGithub />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Unified Devtools Panel',
      icon: <VscWand className="text-slate-400" />,
      description: (
        <div>
          TanStack Devtools provides a centralized panel that houses all
          TanStack library devtools in one place. No more switching between
          different devtools panels - everything you need is{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            organized and accessible from a single interface
          </span>{' '}
          for a streamlined development experience.
        </div>
      ),
    },
    {
      title: 'Framework Agnostic',
      icon: <FaBolt className="text-slate-500" />,
      description: (
        <div>
          Built with Solid.js for lightweight performance, but designed to work
          within any framework. Create and integrate your own custom devtools
          regardless of your tech stack.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            Whether you're using React, Vue, Angular, or any other framework,
          </span>{' '}
          TanStack Devtools provides the flexibility you need.
        </div>
      ),
    },
    {
      title: 'Custom Devtools Support',
      icon: <FaCogs className="text-slate-600" />,
      description: (
        <div>
          Extend the devtools panel with your own custom devtools. The platform
          is designed to be extensible, allowing you to create devtools for your
          specific needs and integrate them seamlessly.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            Build, share, and use custom devtools that enhance your development
            workflow
          </span>{' '}
          while maintaining the same unified experience.
        </div>
      ),
    },
  ],
} satisfies Library
