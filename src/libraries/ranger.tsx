import {
  Book,
  MessageCircleQuestionMark,
  PlugZap,
  RotateCw,
  Wallpaper,
} from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { GithubIcon } from '~/components/icons/GithubIcon'

const repo = 'tanstack/ranger'

const textStyles = 'text-gray-700 dark:text-gray-500'

export const rangerProject = {
  id: 'ranger',
  name: 'TanStack Ranger',
  cardStyles: `text-slate-500 hover:border-current`,
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
      icon: <Book />,
      label: 'Docs',
      to: '/ranger/latest/docs/overview',
    },
    {
      icon: <Wallpaper />,
      label: 'Examples',
      to: '/ranger/latest/docs/framework/react/examples/basic',
    },
    {
      icon: <GithubIcon />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Typesafe & powerful, yet familiarly simple',
      icon: (
        <PlugZap className={twMerge('scale-125 animate-pulse', textStyles)} />
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
        <RotateCw
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
      icon: <MessageCircleQuestionMark className={twMerge('', textStyles)} />,
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
}
