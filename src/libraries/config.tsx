import { Book, WandSparkles, Zap } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { GithubIcon } from '~/components/icons/GithubIcon'
import { CogsIcon } from '~/components/icons/CogsIcon'

const repo = 'tanstack/config'

const textStyles = 'text-gray-700 dark:text-gray-500'

export const configProject = {
  id: 'config',
  name: 'TanStack Config',
  cardStyles: `text-slate-500 hover:border-current`,
  to: '/config',
  tagline: `Configuration and tools for publishing and maintaining high-quality JavaScript packages`,
  description: `Opinionated tooling to lint, build, test, version, and publish JS/TS packages — minimal config, consistent results.`,
  ogImage: 'https://github.com/tanstack/config/raw/main/media/repo-header.png',
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
  frameworks: [],
  menu: [
    {
      icon: <Book />,
      label: 'Docs',
      to: '/config/latest/docs',
    },
    {
      icon: <GithubIcon />,
      label: 'Github',
      to: `https://github.com/${repo}`,
    },
  ],
  featureHighlights: [
    {
      title: 'Intuitive Configuration',
      icon: <WandSparkles className="text-gray-400" />,
      description: (
        <div>
          TanStack Config offers a seamless and intuitive configuration
          management system that simplifies the process of building and
          publishing high-quality JavaScript packages. TanStack Config{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            streamlines the configuration process, allowing developers to focus
            on writing code
          </span>{' '}
          without the hassle of intricate setup procedures.
        </div>
      ),
    },
    {
      title: 'Vite-Powered Builds',
      icon: <Zap className="text-gray-500" />,
      description: (
        <div>
          TanStack Config's build configuration harnesses the Vite ecosystem.
          Customize and extend your build workflows with ease, tailoring them to
          meet the unique requirements of your project.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            Whether you need advanced optimizations, pre-processors, or other
            specialized tools,
          </span>{' '}
          TanStack Config provides a robust foundation for crafting a build
          pipeline that suits your specific needs.
        </div>
      ),
    },
    {
      title: 'Effortless Publication',
      icon: <CogsIcon className="text-gray-700" />,
      description: (
        <div>
          Say goodbye to the complexities of code publishing. This package
          provides tools designed to automate the publication of your projects.
          Developers can effortlessly publish updates, manage versioning, and
          release on npm and GitHub.{' '}
          <span className={twMerge('font-semibold', textStyles)}>
            TanStack Config takes care of the tedious aspects of package
            publishing,
          </span>{' '}
          empowering developers to share their work with the community
          efficiently.
        </div>
      ),
    },
  ],
}
