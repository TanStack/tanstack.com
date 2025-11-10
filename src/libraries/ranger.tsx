import { VscPreview } from 'react-icons/vsc'
import { Library } from '.'
import { FaGithub } from 'react-icons/fa'
import { BiBookAlt } from 'react-icons/bi'
import { CgTimelapse } from 'react-icons/cg'
import { TbZoomQuestion } from 'react-icons/tb'
import { RiLightbulbFlashLine } from 'react-icons/ri'
import { twMerge } from 'tailwind-merge'

const repo = 'tanstack/ranger'

const textStyles = 'text-gray-700 dark:text-gray-500'

export const rangerProject = {
  id: 'ranger',
  name: 'TanStack Ranger',
  cardStyles: `shadow-xl shadow-slate-700/20 dark:shadow-lg dark:shadow-slate-500/30 text-slate-500 border-2 border-transparent hover:border-current`,
  to: '/ranger',
  tagline: `Headless range and multi-range slider utilities.`,
  description: `Headless, lightweight, and extensible primitives for building range and multi-range sliders.`,
  ogImage: 'https://github.com/tanstack/ranger/raw/main/media/headerv1.png',
  badge: undefined,
  bgStyle: 'bg-slate-500',
  textStyle: 'text-slate-500',
  repo,
  latestBranch: 'main',
  latestVersion: 'v0',
  availableVersions: ['v0'],
  bgRadial: 'from-gray-500 via-gray-700/50 to-transparent',
  colorFrom: 'from-gray-500',
  colorTo: 'to-gray-700',
  textColor: 'text-gray-700',
  frameworks: ['react'],
  scarfId: 'dd278e06-bb3f-420c-85c6-6e42d14d8f61',
  menu: [
    {
      icon: <BiBookAlt />,
      label: 'Docs',
      to: '/ranger/latest/docs/overview',
    },
    {
      icon: <VscPreview />,
      label: 'Examples',
      to: '/ranger/latest/docs/framework/react/examples/basic',
    },
    {
      icon: <FaGithub />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Typesafe & powerful, yet familiarly simple',
      icon: (
        <RiLightbulbFlashLine
          className={twMerge('scale-125 animate-pulse', textStyles)}
        />
      ),
      description: (
        <div>
          Hooks for building range and multi-range sliders in React{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            100% typesafe without compromising on DX
          </span>
          .
        </div>
      ),
    },
    {
      title: '"Headless" UI library',
      icon: (
        <CgTimelapse
          className={twMerge('animate-spin', textStyles)}
          style={{
            animationDuration: '3s',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      ),
      description: (
        <div>
          Headless and extensible. Ranger doesn't render or supply any actual UI
          elements. It's a{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            utility for building your own custom-designed UI components
          </span>
          .
        </div>
      ),
    },
    {
      title: 'Extensible',
      icon: <TbZoomQuestion className={twMerge('', textStyles)} />,
      description: (
        <div>
          Designed with maximum inversion of control in mind, Ranger is built to
          be{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            easily extended and customized
          </span>{' '}
          to fit your needs.
        </div>
      ),
    },
  ],
} satisfies Library
